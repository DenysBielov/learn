import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getPublicCourses } from "@/app/actions/courses";
import { PublicHeader } from "@/components/public-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Brain, Repeat, ArrowRight } from "lucide-react";

export default async function LandingPage() {
  const user = await getAuthUser();
  if (user) redirect("/dashboard");

  const { courses: featuredCourses } = await getPublicCourses(1, 6);

  return (
    <div className="min-h-screen">
      <PublicHeader />

      {/* Hero */}
      <section className="container mx-auto max-w-6xl px-4 py-20 sm:py-28 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto">
          Master any subject with spaced repetition
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          Build lasting knowledge with flashcards, quizzes, and structured courses.
          Study smarter by reviewing at the optimal time.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-8 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-11 px-8 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Explore Courses
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/40">
        <div className="container mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-12">
            Everything you need to learn effectively
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Spaced Repetition</h3>
              <p className="text-sm text-muted-foreground">
                Cards are scheduled based on how well you know them, so you review at
                the perfect moment before you forget.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Structured Courses</h3>
              <p className="text-sm text-muted-foreground">
                Organize decks, reading materials, and quizzes into courses with
                dependencies and progress tracking.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <Repeat className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Community Courses</h3>
              <p className="text-sm text-muted-foreground">
                Browse and fork public courses shared by other learners, or share
                your own with the community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      {featuredCourses.length > 0 && (
        <section className="border-t">
          <div className="container mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Featured Courses
              </h2>
              <Link
                href="/explore"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {featuredCourses.map((course) => (
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
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto max-w-6xl px-4 py-8 text-center text-sm text-muted-foreground">
          Built for learners who want to remember what they study.
        </div>
      </footer>
    </div>
  );
}
