"use client";

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  createContext,
  useContext,
  memo,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  richContentComponents,
  urlTransform,
} from "@/components/rich-content";

// --- Types ---

interface Question {
  id: number;
  type: string;
  question: string;
  correctAnswer: string | null;
}

interface ClozeProps {
  question: Question;
  onAnswer: (isCorrect: boolean, userAnswer: string) => void;
  disabled: boolean;
}

interface ClozeBlank {
  index: number;
  group: number;
  answer: string;
  hint?: string;
  fullMatch: string;
}

// --- Module-level constants for stable ReactMarkdown props ---

const clozeRemarkPlugins = [remarkMath, remarkGfm];

const clozeRehypePlugins = [
  [
    rehypeKatex,
    {
      trust: (ctx: { command: string; id?: string }) =>
        ctx.command === "\\htmlId" &&
        /^cloze-\d{1,3}$/.test(ctx.id ?? ""),
      strict: (errorCode: string) =>
        errorCode === "htmlExtension" ? "ignore" : "warn",
    },
  ] as [typeof rehypeKatex, object],
];

// --- React Context for decoupling input state from ReactMarkdown renders ---

interface ClozeInputContextValue {
  userInputs: Record<number, string>;
  setUserInput: (index: number, value: string) => void;
  blankResults: Record<number, boolean>;
  groupChecked: boolean;
  disabled: boolean;
  activeBlanks: ClozeBlank[];
  activeGroup: number;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const ClozeInputContext = createContext<ClozeInputContextValue | null>(null);

// --- Inline input component (renders inside KaTeX output, reads from context) ---

function ClozeInput({ index, blank }: { index: number; blank: ClozeBlank }) {
  const ctx = useContext(ClozeInputContext);
  if (!ctx) return null;

  const isFuture = blank.group !== ctx.activeGroup;

  if (isFuture) {
    const width = Math.max(blank.answer.length + 1, 3);
    return (
      <input
        type="text"
        disabled
        tabIndex={-1}
        className="cloze-inline-input future"
        style={{ width: `${width}ch` }}
      />
    );
  }

  const value = ctx.userInputs[index] ?? "";
  const checked =
    ctx.groupChecked && ctx.blankResults[index] !== undefined;
  const isCorrect = ctx.blankResults[index];
  const width = Math.max(blank.answer.length + 1, 3);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => ctx.setUserInput(index, e.target.value)}
      onKeyDown={ctx.onKeyDown}
      disabled={ctx.disabled || ctx.groupChecked}
      placeholder={blank.hint ?? "..."}
      className={cn(
        "cloze-inline-input",
        checked && isCorrect && "correct",
        checked && !isCorrect && "incorrect",
      )}
      style={{ width: `${width}ch` }}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

// --- Memoized ReactMarkdown wrapper (skips re-renders on keystroke) ---

const ClozeMarkdown = memo(function ClozeMarkdown({
  content,
  components,
}: {
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: Record<string, any>;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={clozeRemarkPlugins}
      rehypePlugins={clozeRehypePlugins}
      urlTransform={urlTransform}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
});

// --- Helper functions ---

/**
 * Normalize a cloze answer for comparison:
 * - Strip all backslashes (\det → det, \| → |)
 * - Normalize multiplication symbols (cdot, times, ·, ×) → *
 * - Strip whitespace entirely for lenient matching
 * - Case-insensitive
 */
function normalizeClozeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\\/g, "")
    .replace(/\b(cdot|times|dot)\b|[·×]/g, "*")
    .replace(/\s+/g, "");
}

/** Convert a LaTeX cloze answer to readable text for display. */
function displayClozeAnswer(s: string): string {
  return s
    .replace(/\\cdot\b/g, "·")
    .replace(/\\times\b/g, "×")
    .replace(/\\\|/g, "|")
    .replace(/\\([a-zA-Z]+)/g, "$1");
}

function parseClozeText(text: string): ClozeBlank[] {
  const blanks: ClozeBlank[] = [];
  const regex = /\{\{c(\d+)::([^}]*?)\}\}/g;
  let index = 0;

  for (const match of text.matchAll(regex)) {
    const group = parseInt(match[1], 10);
    const inner = match[2];
    const parts = inner.split("::");
    const answer = parts[0];
    const hint = parts.length > 1 ? parts[1] : undefined;

    blanks.push({ index, group, answer, hint, fullMatch: match[0] });
    index++;
  }

  return blanks;
}

function getGroups(blanks: ClozeBlank[]): number[] {
  const groupSet = new Set(blanks.map((b) => b.group));
  return Array.from(groupSet).sort((a, b) => a - b);
}

/**
 * Find math delimiter regions ($...$ and $$...$$) in text.
 * Handles \$ escapes via negative lookbehind.
 * Known limitation: doesn't handle $ inside code spans or code blocks.
 */
function findMathRegions(text: string): Array<[number, number]> {
  const regions: Array<[number, number]> = [];
  const regex =
    /(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$|(?<!\\)\$(?!\$)[\s\S]*?(?<!\\)\$(?!\$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    regions.push([match.index, match.index + match[0].length]);
  }
  return regions;
}

/**
 * Replace cloze markers with \htmlId placeholders (for KaTeX) or plain text.
 *
 * - Active + future blanks → \htmlId{cloze-N}{\square} (inline math wrapper if outside math)
 * - Revealed blanks → answer text
 */
function buildClozeDisplayText(
  text: string,
  blanks: ClozeBlank[],
  checkedGroups: Set<number>,
): string {
  const hasMath = text.includes("$");

  if (!hasMath) {
    // Fast path: no math delimiters — wrap non-revealed blanks in inline math
    let idx = 0;
    return text.replace(
      /\{\{c(\d+)::([^}]*?)(?:::[^}]*)?\}\}/g,
      (_match, _groupStr, answer) => {
        const blank = blanks[idx++];
        if (!blank) return answer;
        if (checkedGroups.has(blank.group)) return answer;
        return `$\\htmlId{cloze-${blank.index}}{\\square}$`;
      },
    );
  }

  // Math path: identify math regions first, then replace cloze markers
  const mathRegions = findMathRegions(text);

  let idx = 0;
  return text.replace(
    /\{\{c(\d+)::([^}]*?)(?:::[^}]*)?\}\}/g,
    (fullMatch, _groupStr, answer, offset: number) => {
      const blank = blanks[idx++];
      if (!blank) return answer;

      if (checkedGroups.has(blank.group)) {
        return answer;
      }

      const inMath = mathRegions.some(
        ([start, end]) => offset >= start && offset < end,
      );

      return inMath
        ? `\\htmlId{cloze-${blank.index}}{\\square}`
        : `$\\htmlId{cloze-${blank.index}}{\\square}$`;
    },
  );
}

// --- Main component ---

export function Cloze({ question, onAnswer, disabled }: ClozeProps) {
  const clozeData = useMemo(() => {
    if (!question.correctAnswer) return null;
    try {
      return JSON.parse(question.correctAnswer) as { text: string };
    } catch {
      return null;
    }
  }, [question.correctAnswer]);

  const clozeText = clozeData?.text ?? "";

  const blanks = useMemo(() => parseClozeText(clozeText), [clozeText]);
  const groups = useMemo(() => getGroups(blanks), [blanks]);

  const [currentGroupIdx, setCurrentGroupIdx] = useState(0);
  const [userInputs, setUserInputs] = useState<Record<number, string>>({});
  const [checkedGroups, setCheckedGroups] = useState<Set<number>>(new Set());
  const [blankResults, setBlankResults] = useState<Record<number, boolean>>(
    {},
  );
  const [allGroupsDone, setAllGroupsDone] = useState(false);
  const [groupChecked, setGroupChecked] = useState(false);

  const activeGroup = groups[currentGroupIdx] ?? 1;
  const activeBlanks = useMemo(
    () => blanks.filter((b) => b.group === activeGroup),
    [blanks, activeGroup],
  );

  // Display text — memoized on group state, NOT userInputs
  const displayText = useMemo(
    () => buildClozeDisplayText(clozeText, blanks, checkedGroups),
    [clozeText, blanks, checkedGroups],
  );

  // Ref for blank lookup map — includes all non-checked blanks (active + future)
  const blankLookupMapRef = useRef<Map<number, ClozeBlank>>(new Map());
  blankLookupMapRef.current = new Map(
    blanks.filter((b) => !checkedGroups.has(b.group)).map((b) => [b.index, b]),
  );

  // Stable input handler
  const setUserInput = useCallback((index: number, value: string) => {
    setUserInputs((prev) => ({ ...prev, [index]: value }));
  }, []);

  const computeCurrentGroupResults = (): Record<number, boolean> => {
    const newResults: Record<number, boolean> = { ...blankResults };
    for (const blank of activeBlanks) {
      const userVal = normalizeClozeAnswer((userInputs[blank.index] ?? ""));
      const correctVal = normalizeClozeAnswer(blank.answer);
      newResults[blank.index] = userVal === correctVal;
    }
    return newResults;
  };

  const handleCheckGroup = () => {
    const newResults = computeCurrentGroupResults();
    setBlankResults(newResults);
    setGroupChecked(true);
    setCheckedGroups((prev) => new Set([...prev, activeGroup]));
  };

  const handleNextGroup = () => {
    const nextIdx = currentGroupIdx + 1;

    if (nextIdx >= groups.length) {
      const finalResults = computeCurrentGroupResults();
      setAllGroupsDone(true);
      const allCorrect = blanks.every(
        (b) => finalResults[b.index] === true,
      );
      const userAnswer = blanks
        .map(
          (b) =>
            `c${b.group}: ${(userInputs[b.index] ?? "").trim() || "(empty)"}`,
        )
        .join(", ");
      onAnswer(allCorrect, userAnswer);
    } else {
      setCurrentGroupIdx(nextIdx);
      setGroupChecked(false);
    }
  };

  // Ref-based key handler to avoid stale closures in context
  const handleKeyDownRef = useRef<
    (e: React.KeyboardEvent<HTMLInputElement>) => void
  >(() => {});
  handleKeyDownRef.current = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter" && !disabled && !groupChecked) {
      const allFilled = activeBlanks.every(
        (b) => (userInputs[b.index] ?? "").trim() !== "",
      );
      if (allFilled) {
        handleCheckGroup();
      }
    }
  };
  const stableKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) =>
      handleKeyDownRef.current(e),
    [],
  );

  // Stable components object — span reads blankLookupMapRef.current at invocation time
  const clozeComponents = useMemo(
    () => ({
      ...richContentComponents,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      span: (props: any) => {
        const { id, children, ...rest } = props;
        if (!id) return <span {...rest}>{children}</span>;
        if (typeof id === "string" && id.startsWith("cloze-")) {
          const index = parseInt(id.split("-")[1], 10);
          const blank = !isNaN(index) ? blankLookupMapRef.current.get(index) : undefined;
          if (blank) {
            return <ClozeInput index={index} blank={blank} />;
          }
        }
        return (
          <span id={id} {...rest}>
            {children}
          </span>
        );
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // blankLookupMapRef is a ref — .current is read at invocation time, not closure time
  );

  // Context value — memoized to avoid unnecessary consumer re-renders
  const ctxValue = useMemo<ClozeInputContextValue>(
    () => ({
      userInputs,
      setUserInput,
      blankResults,
      groupChecked,
      disabled,
      activeBlanks,
      activeGroup,
      onKeyDown: stableKeyDown,
    }),
    [
      userInputs,
      setUserInput,
      blankResults,
      groupChecked,
      disabled,
      activeBlanks,
      activeGroup,
      stableKeyDown,
    ],
  );

  const allActiveFilled = activeBlanks.every(
    (b) => (userInputs[b.index] ?? "").trim() !== "",
  );

  // Wrong blanks for correction display after check
  const wrongBlanks = groupChecked
    ? activeBlanks.filter((b) => blankResults[b.index] === false)
    : [];

  if (!clozeData) {
    return (
      <div className="text-muted-foreground text-sm">
        Invalid cloze question data.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Group progress */}
      {groups.length > 1 && (
        <p className="text-muted-foreground text-sm">
          Group {currentGroupIdx + 1} of {groups.length}
        </p>
      )}

      {/* Rendered cloze text with inline inputs */}
      <div className="rounded-lg border p-4 leading-relaxed text-base">
        <ClozeInputContext.Provider value={ctxValue}>
          <ClozeMarkdown
            content={displayText}
            components={clozeComponents}
          />
        </ClozeInputContext.Provider>
      </div>

      {/* Correct answers for wrong blanks */}
      {wrongBlanks.length > 0 && (
        <div className="space-y-1">
          {wrongBlanks.map((blank) => (
            <div key={blank.index} className="text-sm text-muted-foreground">
              <span className="text-destructive line-through">
                {(userInputs[blank.index] ?? "").trim() || "(empty)"}
              </span>
              {" → "}
              <span className="text-green-600 font-medium">
                {displayClozeAnswer(blank.answer)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {!disabled && !allGroupsDone && (
        <>
          {!groupChecked && (
            <Button
              onClick={handleCheckGroup}
              disabled={!allActiveFilled}
              className="w-full"
            >
              Check Answers
            </Button>
          )}

          {groupChecked && (
            <Button onClick={handleNextGroup} className="w-full">
              {currentGroupIdx + 1 < groups.length
                ? "Next Group"
                : "Submit"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
