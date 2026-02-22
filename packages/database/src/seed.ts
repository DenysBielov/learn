import { getDb, closeDb } from "./index.js";
import {
  users,
  courses,
  decks,
  courseDecks,
  flashcards,
  quizQuestions,
  questionOptions,
} from "./schema.js";
import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";

const BCRYPT_ROUNDS = 10;
const TEST_EMAIL = "test@test.com";
const TEST_PASSWORD = "test";

function generateMcpToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

async function main() {
  const db = getDb();

  try {
    // 1. Create user (idempotent)
    let userId: number;
    const existing = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, TEST_EMAIL))
      .get();

    if (existing) {
      userId = existing.id;
      // Reset password to known value
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
      db.update(users).set({ passwordHash }).where(eq(users.id, userId)).run();
      console.log(`User "${TEST_EMAIL}" already exists (id=${userId}), password reset to "${TEST_PASSWORD}"`);
    } else {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_ROUNDS);
      const { token, hash: mcpTokenHash } = generateMcpToken();

      const [user] = db
        .insert(users)
        .values({ email: TEST_EMAIL, passwordHash, mcpTokenHash })
        .returning({ id: users.id }).all();

      userId = user.id;
      console.log(`Created user "${TEST_EMAIL}" (id=${userId})`);
      console.log(`MCP token: ${token}`);
    }

    // Skip data seeding if user already has courses
    const existingCourses = db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.userId, userId))
      .all();

    if (existingCourses.length > 0) {
      console.log(`User already has ${existingCourses.length} course(s), skipping data seed.`);
      return;
    }

    // 2. Create parent course: AI/ML
    const [aiMlCourse] = db
      .insert(courses)
      .values({
        name: "AI/ML",
        description: "Artificial Intelligence and Machine Learning fundamentals",
        userId,
        color: "#8b5cf6",
        isActive: true,
        position: 0,
      })
      .returning({ id: courses.id }).all();

    // 3. Create subcourses
    const [linearAlgebra] = db
      .insert(courses)
      .values({
        name: "Linear Algebra",
        description: "Vectors, matrices, and transformations for ML",
        parentId: aiMlCourse.id,
        userId,
        color: "#3b82f6",
        isActive: true,
        position: 0,
      })
      .returning({ id: courses.id }).all();

    const [probStats] = db
      .insert(courses)
      .values({
        name: "Probability & Statistics",
        description: "Probability theory and statistical methods for ML",
        parentId: aiMlCourse.id,
        userId,
        color: "#10b981",
        isActive: true,
        position: 1,
      })
      .returning({ id: courses.id }).all();

    // 4. Create decks + content for Linear Algebra
    const [vectorsDeck] = db
      .insert(decks)
      .values({ name: "Vectors & Spaces", description: "Vector operations and vector spaces", userId })
      .returning({ id: decks.id }).all();

    const [matricesDeck] = db
      .insert(decks)
      .values({ name: "Matrices", description: "Matrix operations and properties", userId })
      .returning({ id: decks.id }).all();

    db.insert(courseDecks).values([
      { courseId: linearAlgebra.id, deckId: vectorsDeck.id, position: 0 },
      { courseId: linearAlgebra.id, deckId: matricesDeck.id, position: 1 },
    ]).run();

    // Flashcards for Vectors
    db.insert(flashcards).values([
      { deckId: vectorsDeck.id, front: "What is a unit vector?", back: "A vector with magnitude 1. Any vector can be converted to a unit vector by dividing it by its magnitude: û = v/||v||" },
      { deckId: vectorsDeck.id, front: "What is the dot product of two vectors?", back: "The sum of the products of corresponding components: a·b = Σ(aᵢbᵢ). Geometrically: a·b = ||a|| ||b|| cos(θ)" },
      { deckId: vectorsDeck.id, front: "What does it mean for vectors to be linearly independent?", back: "A set of vectors is linearly independent if no vector can be written as a linear combination of the others. Equivalently, c₁v₁ + c₂v₂ + ... = 0 only when all cᵢ = 0." },
    ]).run();

    // Flashcards for Matrices
    db.insert(flashcards).values([
      { deckId: matricesDeck.id, front: "What is the transpose of a matrix?", back: "The matrix obtained by swapping rows and columns: (Aᵀ)ᵢⱼ = Aⱼᵢ" },
      { deckId: matricesDeck.id, front: "What is an identity matrix?", back: "A square matrix with 1s on the main diagonal and 0s elsewhere. For any matrix A: AI = IA = A" },
      { deckId: matricesDeck.id, front: "What is the determinant used for?", back: "It indicates whether a matrix is invertible (det ≠ 0), measures volume scaling of the linear transformation, and appears in eigenvalue calculations." },
    ]).run();

    // Quiz questions for Vectors (multiple_choice)
    const [q1] = db
      .insert(quizQuestions)
      .values({ deckId: vectorsDeck.id, type: "multiple_choice", question: "What is the result of the dot product of two orthogonal vectors?", explanation: "Orthogonal vectors meet at 90°, and cos(90°) = 0, so their dot product is always 0." })
      .returning({ id: quizQuestions.id }).all();

    db.insert(questionOptions).values([
      { questionId: q1.id, optionText: "0", isCorrect: true },
      { questionId: q1.id, optionText: "1", isCorrect: false },
      { questionId: q1.id, optionText: "Their magnitudes multiplied", isCorrect: false },
      { questionId: q1.id, optionText: "Undefined", isCorrect: false },
    ]).run();

    // Quiz question (true_false)
    const [q2] = db
      .insert(quizQuestions)
      .values({ deckId: vectorsDeck.id, type: "true_false", question: "The cross product of two vectors results in a scalar.", explanation: "The cross product results in a vector perpendicular to both input vectors, not a scalar." })
      .returning({ id: quizQuestions.id }).all();

    db.insert(questionOptions).values([
      { questionId: q2.id, optionText: "True", isCorrect: false },
      { questionId: q2.id, optionText: "False", isCorrect: true },
    ]).run();

    // Quiz question (free_text) for Matrices
    db.insert(quizQuestions).values({
      deckId: matricesDeck.id,
      type: "free_text",
      question: "What is the term for a matrix where all entries below the main diagonal are zero?",
      correctAnswer: JSON.stringify(["upper triangular", "upper triangular matrix"]),
      explanation: "An upper triangular matrix has all zero entries below the main diagonal.",
    }).run();

    // Quiz question (matching) for Vectors — 4 pairs
    db.insert(quizQuestions).values({
      deckId: vectorsDeck.id,
      type: "matching",
      question: "Match each vector operation to its result type:",
      correctAnswer: JSON.stringify([
        { left: "Dot product", right: "Scalar" },
        { left: "Cross product", right: "Vector" },
        { left: "Scalar multiplication", right: "Scaled vector" },
        { left: "Vector addition", right: "Resultant vector" },
      ]),
      explanation: "The dot product yields a scalar, the cross product yields a perpendicular vector, scalar multiplication scales a vector, and addition gives the resultant.",
    }).run();

    // Quiz question (matching) for Matrices — 5 pairs
    db.insert(quizQuestions).values({
      deckId: matricesDeck.id,
      type: "matching",
      question: "Match each matrix type to its defining property:",
      correctAnswer: JSON.stringify([
        { left: "Identity matrix", right: "1s on diagonal, 0s elsewhere" },
        { left: "Symmetric matrix", right: "$A = A^T$" },
        { left: "Orthogonal matrix", right: "$A^T A = I$" },
        { left: "Diagonal matrix", right: "Non-zero entries only on diagonal" },
        { left: "Singular matrix", right: "Determinant equals zero" },
      ]),
      explanation: "Each special matrix type is defined by a unique structural or algebraic property.",
    }).run();

    // 5. Create decks + content for Probability & Statistics
    const [probDeck] = db
      .insert(decks)
      .values({ name: "Probability Basics", description: "Core probability concepts", userId })
      .returning({ id: decks.id }).all();

    const [distDeck] = db
      .insert(decks)
      .values({ name: "Distributions", description: "Common probability distributions", userId })
      .returning({ id: decks.id }).all();

    db.insert(courseDecks).values([
      { courseId: probStats.id, deckId: probDeck.id, position: 0 },
      { courseId: probStats.id, deckId: distDeck.id, position: 1 },
    ]).run();

    // Flashcards for Probability Basics
    db.insert(flashcards).values([
      { deckId: probDeck.id, front: "What is Bayes' theorem?", back: "P(A|B) = P(B|A) × P(A) / P(B). It describes how to update the probability of a hypothesis given new evidence." },
      { deckId: probDeck.id, front: "What is the difference between independent and mutually exclusive events?", back: "Independent: P(A∩B) = P(A)P(B) — one event doesn't affect the other. Mutually exclusive: P(A∩B) = 0 — both events cannot occur simultaneously." },
      { deckId: probDeck.id, front: "What is conditional probability?", back: "The probability of event A given event B has occurred: P(A|B) = P(A∩B) / P(B)" },
    ]).run();

    // Flashcards for Distributions
    db.insert(flashcards).values([
      { deckId: distDeck.id, front: "What is the normal distribution?", back: "A continuous distribution defined by mean (μ) and standard deviation (σ). Bell-shaped, symmetric. ~68% of data within 1σ, ~95% within 2σ, ~99.7% within 3σ." },
      { deckId: distDeck.id, front: "When do you use a Bernoulli distribution?", back: "For a single trial with two outcomes (success/failure). P(X=1) = p, P(X=0) = 1-p. Mean = p, Variance = p(1-p)." },
    ]).run();

    // Quiz questions for Probability (multiple_choice)
    const [q3] = db
      .insert(quizQuestions)
      .values({ deckId: probDeck.id, type: "multiple_choice", question: "If P(A) = 0.3 and P(B) = 0.5, and A and B are independent, what is P(A ∩ B)?", explanation: "For independent events, P(A∩B) = P(A) × P(B) = 0.3 × 0.5 = 0.15" })
      .returning({ id: quizQuestions.id }).all();

    db.insert(questionOptions).values([
      { questionId: q3.id, optionText: "0.15", isCorrect: true },
      { questionId: q3.id, optionText: "0.80", isCorrect: false },
      { questionId: q3.id, optionText: "0.20", isCorrect: false },
      { questionId: q3.id, optionText: "0.50", isCorrect: false },
    ]).run();

    // Quiz question (true_false)
    const [q4] = db
      .insert(quizQuestions)
      .values({ deckId: distDeck.id, type: "true_false", question: "The standard normal distribution has a mean of 0 and standard deviation of 1.", explanation: "By definition, the standard normal distribution (Z-distribution) has μ=0 and σ=1." })
      .returning({ id: quizQuestions.id }).all();

    db.insert(questionOptions).values([
      { questionId: q4.id, optionText: "True", isCorrect: true },
      { questionId: q4.id, optionText: "False", isCorrect: false },
    ]).run();

    // Quiz question (free_text) for Distributions
    db.insert(quizQuestions).values({
      deckId: distDeck.id,
      type: "free_text",
      question: "What distribution models the number of events occurring in a fixed interval of time?",
      correctAnswer: JSON.stringify(["poisson", "poisson distribution"]),
      explanation: "The Poisson distribution models the number of events in a fixed interval, given a known average rate.",
    }).run();

    // Quiz question (matching) for Probability — 4 pairs
    db.insert(quizQuestions).values({
      deckId: probDeck.id,
      type: "matching",
      question: "Match each probability concept to its formula:",
      correctAnswer: JSON.stringify([
        { left: "Bayes' theorem", right: "$P(A|B) = \\frac{P(B|A)P(A)}{P(B)}$" },
        { left: "Conditional probability", right: "$P(A|B) = \\frac{P(A \\cap B)}{P(B)}$" },
        { left: "Independent events", right: "$P(A \\cap B) = P(A) \\cdot P(B)$" },
        { left: "Complement rule", right: "$P(A') = 1 - P(A)$" },
      ]),
      explanation: "Each probability concept has a specific formula that defines its calculation.",
    }).run();

    // Quiz question (matching) for Distributions — 7 pairs (long list test)
    db.insert(quizQuestions).values({
      deckId: distDeck.id,
      type: "matching",
      question: "Match each probability distribution to its typical use case:",
      correctAnswer: JSON.stringify([
        { left: "Normal", right: "Heights of people in a population" },
        { left: "Bernoulli", right: "Single coin flip" },
        { left: "Binomial", right: "Number of heads in 10 coin flips" },
        { left: "Poisson", right: "Emails received per hour" },
        { left: "Exponential", right: "Time between bus arrivals" },
        { left: "Uniform", right: "Rolling a fair die" },
        { left: "Geometric", right: "Flips until first heads" },
      ]),
      explanation: "Each distribution models a specific type of random phenomenon based on its underlying assumptions.",
    }).run();

    console.log("\nSeeded data:");
    console.log("  Course: AI/ML");
    console.log("    Subcourse: Linear Algebra (2 decks, 6 flashcards, 5 quiz questions)");
    console.log("    Subcourse: Probability & Statistics (2 decks, 5 flashcards, 5 quiz questions)");
    console.log("\nDone!");
  } finally {
    closeDb();
  }
}

main();
