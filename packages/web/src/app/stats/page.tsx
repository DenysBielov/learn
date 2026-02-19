import { getStudyStats } from "@/app/actions/stats";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Flame, Clock, BookOpen, Target, TrendingUp, CheckCircle } from "lucide-react";

export default async function StatsPage() {
  const stats = await getStudyStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Statistics</h1>
        <p className="text-muted-foreground mt-2">
          Track your learning progress and achievements
        </p>
      </div>

      {/* Overview Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Study Streak</p>
                <p className="text-3xl font-bold mt-1">{stats.streak}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.streak === 1 ? "day" : "days"}
                </p>
              </div>
              <Flame className="h-10 w-10 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cards Due</p>
                <p className="text-3xl font-bold mt-1">{stats.dueNow}</p>
                <p className="text-xs text-muted-foreground mt-1">ready to review</p>
              </div>
              <Clock className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-3xl font-bold mt-1">{stats.totalSessions}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.todaySessions} today
                </p>
              </div>
              <BookOpen className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accuracy Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Flashcard Accuracy
            </CardTitle>
            <CardDescription>
              {stats.totalCardsReviewed} cards reviewed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{stats.flashcardAccuracy}%</span>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all"
                  style={{ width: `${stats.flashcardAccuracy}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Quiz Accuracy
            </CardTitle>
            <CardDescription>
              {stats.totalQuizAnswers} questions answered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{stats.quizAccuracy}%</span>
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
              <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: `${stats.quizAccuracy}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card Mastery Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Card Mastery
          </CardTitle>
          <CardDescription>
            {stats.totalCards} total cards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual bar chart */}
          <div className="w-full bg-secondary rounded-full h-6 overflow-hidden flex">
            {stats.totalCards > 0 && (
              <>
                <div
                  className="bg-gray-400 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${(stats.newCards / stats.totalCards) * 100}%` }}
                >
                  {stats.newCards > 0 && stats.newCards}
                </div>
                <div
                  className="bg-yellow-500 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${(stats.learningCards / stats.totalCards) * 100}%` }}
                >
                  {stats.learningCards > 0 && stats.learningCards}
                </div>
                <div
                  className="bg-green-500 flex items-center justify-center text-xs text-white font-medium"
                  style={{ width: `${(stats.masteredCards / stats.totalCards) * 100}%` }}
                >
                  {stats.masteredCards > 0 && stats.masteredCards}
                </div>
              </>
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-400" />
              <div>
                <p className="text-sm font-medium">New</p>
                <p className="text-2xl font-bold">{stats.newCards}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500" />
              <div>
                <p className="text-sm font-medium">Learning</p>
                <p className="text-2xl font-bold">{stats.learningCards}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <div>
                <p className="text-sm font-medium">Mastered</p>
                <p className="text-2xl font-bold">{stats.masteredCards}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Cards Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.totalCardsReviewed}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Quiz Answers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{stats.totalQuizAnswers}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
