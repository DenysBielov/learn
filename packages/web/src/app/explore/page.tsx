import Link from "next/link";
import { getPublicCourses } from "@/app/actions/courses";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Explore Courses — Flashcards",
};

interface ExplorePageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const search = q?.trim() || undefined;

  const { courses, total, totalPages } = await getPublicCourses(page, 20, search);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Explore Courses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse public courses shared by the community
        </p>
      </div>

      {/* Search */}
      <form action="/explore" method="GET">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            name="q"
            placeholder="Search courses..."
            defaultValue={q ?? ""}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </form>

      {/* Results count */}
      {search && (
        <div className="text-sm text-muted-foreground">
          {total} result{total !== 1 ? "s" : ""} for &quot;{search}&quot;
          <Link href="/explore" className="ml-2 text-primary hover:underline">
            Clear
          </Link>
        </div>
      )}

      {/* Course grid */}
      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg className="h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {search ? "No courses found" : "No public courses yet"}
          </h2>
          <p className="text-muted-foreground max-w-sm">
            {search
              ? "Try a different search term."
              : "Check back later for courses shared by the community."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.publicId} href={`/courses/${course.publicId}`} className="block">
              <Card className="h-full overflow-hidden transition-colors hover:bg-[var(--card-hover)] hover:border-[var(--border-hover)]">
                <div className="h-1.5" style={{ backgroundColor: course.color }} />
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="truncate">{course.name}</CardTitle>
                    <Badge variant={course.visibility === "forkable" ? "default" : "secondary"} className="shrink-0">
                      {course.visibility}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {course.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{course.authorName}</span>
                    <span>{course.stepCount} step{course.stepCount !== 1 ? "s" : ""}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/explore?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(page - 1) }).toString()}`}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/explore?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(page + 1) }).toString()}`}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
