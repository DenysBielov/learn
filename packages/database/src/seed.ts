import { getDb, closeDb } from "./index.js";
import {
  users,
  courses,
  decks,
  courseDecks,
  flashcards,
  quizQuestions,
  questionOptions,
  courseSteps,
  stepProgress,
  flashcardTags,
  questionTags,
  studySessions,
  sessionActivities,
  flashcardResults,
  quizResults,
  cardFlags,
  learningMaterials,
  chatConversations,
  chatMessages,
  pushSubscriptions,
  learningDependencies,
  materialTags,
  materialDecks,
  materialQuizzes,
  materialResources,
  materials,
  quizzes,
  tags,
  events,
} from "./schema.js";
import { eq } from "drizzle-orm";

const TEST_EMAIL = "test@test.com";

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
      console.log(`User "${TEST_EMAIL}" already exists (id=${userId})`);
    } else {
      const [user] = db
        .insert(users)
        .values({ email: TEST_EMAIL })
        .returning({ id: users.id }).all();

      userId = user.id;
      console.log(`Created user "${TEST_EMAIL}" (id=${userId})`);
    }

    // Delete all existing data (order matters for foreign keys)
    console.log("Clearing existing data...");
    db.delete(flashcardResults).run();
    db.delete(quizResults).run();
    db.delete(sessionActivities).run();
    db.delete(studySessions).run();
    db.delete(cardFlags).run();
    db.delete(chatMessages).run();
    db.delete(chatConversations).run();
    db.delete(pushSubscriptions).run();
    db.delete(events).run();
    db.delete(learningDependencies).run();
    db.delete(learningMaterials).run();
    db.delete(materialResources).run();
    db.delete(materialQuizzes).run();
    db.delete(materialDecks).run();
    db.delete(materialTags).run();
    db.delete(flashcardTags).run();
    db.delete(questionTags).run();
    db.delete(questionOptions).run();
    db.delete(quizQuestions).run();
    db.delete(flashcards).run();
    db.delete(stepProgress).run();
    db.delete(courseSteps).run();
    db.delete(courseDecks).run();
    db.delete(decks).run();
    db.delete(materials).run();
    db.delete(quizzes).run();
    db.delete(tags).run();
    db.delete(courses).run();
    console.log("Done clearing.");

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
        visibility: "forkable",
      })
      .returning({ id: courses.id }).all();

    // 3. Create subcourses
    const [linearAlgebra] = db
      .insert(courses)
      .values({
        name: "Linear Algebra",
        description: "Vectors, matrices, and transformations for ML",
        parentId: aiMlCourse.id,
        rootCourseId: aiMlCourse.id,
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
        rootCourseId: aiMlCourse.id,
        userId,
        color: "#10b981",
        isActive: true,
        position: 1,
      })
      .returning({ id: courses.id }).all();

    // Create quizzes early so questions can reference them
    const [linAlgQuiz] = db
      .insert(quizzes)
      .values({
        title: "Linear Algebra Fundamentals",
        description: "Test your understanding of vectors and matrices",
        userId,
      })
      .returning({ id: quizzes.id }).all();

    const [probQuiz] = db
      .insert(quizzes)
      .values({
        title: "Probability & Statistics Assessment",
        description: "Comprehensive quiz on probability concepts and distributions",
        userId,
      })
      .returning({ id: quizzes.id }).all();

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
      .values({ deckId: vectorsDeck.id, quizId: linAlgQuiz.id, type: "multiple_choice", question: "What is the result of the dot product of two orthogonal vectors?", explanation: "Orthogonal vectors meet at 90°, and cos(90°) = 0, so their dot product is always 0." })
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
      .values({ deckId: vectorsDeck.id, quizId: linAlgQuiz.id, type: "true_false", question: "The cross product of two vectors results in a scalar.", explanation: "The cross product results in a vector perpendicular to both input vectors, not a scalar." })
      .returning({ id: quizQuestions.id }).all();

    db.insert(questionOptions).values([
      { questionId: q2.id, optionText: "True", isCorrect: false },
      { questionId: q2.id, optionText: "False", isCorrect: true },
    ]).run();

    // Quiz question (free_text) for Matrices
    db.insert(quizQuestions).values({
      deckId: matricesDeck.id,
      quizId: linAlgQuiz.id,
      type: "free_text",
      question: "What is the term for a matrix where all entries below the main diagonal are zero?",
      correctAnswer: JSON.stringify(["upper triangular", "upper triangular matrix"]),
      explanation: "An upper triangular matrix has all zero entries below the main diagonal.",
    }).run();

    // Quiz question (matching) for Vectors — 4 pairs
    db.insert(quizQuestions).values({
      deckId: vectorsDeck.id,
      quizId: linAlgQuiz.id,
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
      quizId: linAlgQuiz.id,
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
      .values({ deckId: probDeck.id, quizId: probQuiz.id, type: "multiple_choice", question: "If P(A) = 0.3 and P(B) = 0.5, and A and B are independent, what is P(A ∩ B)?", explanation: "For independent events, P(A∩B) = P(A) × P(B) = 0.3 × 0.5 = 0.15" })
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
      .values({ deckId: distDeck.id, quizId: probQuiz.id, type: "true_false", question: "The standard normal distribution has a mean of 0 and standard deviation of 1.", explanation: "By definition, the standard normal distribution (Z-distribution) has μ=0 and σ=1." })
      .returning({ id: quizQuestions.id }).all();

    db.insert(questionOptions).values([
      { questionId: q4.id, optionText: "True", isCorrect: true },
      { questionId: q4.id, optionText: "False", isCorrect: false },
    ]).run();

    // Quiz question (free_text) for Distributions
    db.insert(quizQuestions).values({
      deckId: distDeck.id,
      quizId: probQuiz.id,
      type: "free_text",
      question: "What distribution models the number of events occurring in a fixed interval of time?",
      correctAnswer: JSON.stringify(["poisson", "poisson distribution"]),
      explanation: "The Poisson distribution models the number of events in a fixed interval, given a known average rate.",
    }).run();

    // Quiz question (matching) for Probability — 4 pairs
    db.insert(quizQuestions).values({
      deckId: probDeck.id,
      quizId: probQuiz.id,
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
      quizId: probQuiz.id,
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

    // 6. Create materials
    const [vectorsMaterial] = db
      .insert(materials)
      .values({
        title: "Introduction to Vectors",
        description: "Comprehensive guide to vectors in linear algebra",
        content: `# Vectors in Linear Algebra

## What is a Vector?

A vector is a mathematical object that has both **magnitude** (length) and **direction**. In linear algebra, vectors are typically represented as ordered lists of numbers called components.

### Notation

- A vector in ℝ² can be written as **v** = (v₁, v₂)
- A vector in ℝ³ as **v** = (v₁, v₂, v₃)
- More generally, a vector in ℝⁿ as **v** = (v₁, v₂, ..., vₙ)

## Vector Operations

### Addition
Two vectors are added component-wise:
**u** + **v** = (u₁ + v₁, u₂ + v₂, ..., uₙ + vₙ)

### Scalar Multiplication
A vector multiplied by a scalar c:
c**v** = (cv₁, cv₂, ..., cvₙ)

### Dot Product
The dot product of two vectors:
**u** · **v** = u₁v₁ + u₂v₂ + ... + uₙvₙ

The geometric interpretation: **u** · **v** = ||**u**|| ||**v**|| cos(θ)

### Cross Product (ℝ³ only)
The cross product produces a vector perpendicular to both inputs:
**u** × **v** = (u₂v₃ - u₃v₂, u₃v₁ - u₁v₃, u₁v₂ - u₂v₁)

## Vector Spaces

A vector space V over a field F is a set equipped with addition and scalar multiplication satisfying eight axioms:
1. Closure under addition
2. Commutativity of addition
3. Associativity of addition
4. Existence of additive identity (zero vector)
5. Existence of additive inverse
6. Closure under scalar multiplication
7. Distributivity over vector addition
8. Distributivity over field addition

## Linear Independence

Vectors **v₁**, **v₂**, ..., **vₖ** are **linearly independent** if the only solution to:
c₁**v₁** + c₂**v₂** + ... + cₖ**vₖ** = **0**
is c₁ = c₂ = ... = cₖ = 0.

## Basis and Dimension

A **basis** of a vector space V is a set of linearly independent vectors that span V. The number of vectors in a basis is the **dimension** of V.`,
        userId,
      })
      .returning({ id: materials.id }).all();

    const [matricesMaterial] = db
      .insert(materials)
      .values({
        title: "Matrix Operations & Properties",
        description: "Deep dive into matrix algebra and key properties",
        content: `# Matrix Operations & Properties

## What is a Matrix?

A matrix is a rectangular array of numbers arranged in rows and columns. An m×n matrix has m rows and n columns.

## Basic Operations

### Matrix Addition
Matrices of the same dimensions are added element-wise:
(A + B)ᵢⱼ = Aᵢⱼ + Bᵢⱼ

### Scalar Multiplication
Every element is multiplied by the scalar:
(cA)ᵢⱼ = c · Aᵢⱼ

### Matrix Multiplication
For matrices A (m×n) and B (n×p), the product C = AB is an m×p matrix:
Cᵢⱼ = Σₖ AᵢₖBₖⱼ

**Note:** Matrix multiplication is NOT commutative: AB ≠ BA in general.

## Special Matrices

| Matrix Type | Property |
|------------|----------|
| Identity (I) | Aᵢⱼ = 1 if i=j, 0 otherwise |
| Diagonal | Non-zero entries only on main diagonal |
| Symmetric | A = Aᵀ |
| Orthogonal | AᵀA = AAᵀ = I |
| Upper Triangular | All entries below diagonal are zero |
| Lower Triangular | All entries above diagonal are zero |

## Transpose

The transpose Aᵀ is obtained by swapping rows and columns:
(Aᵀ)ᵢⱼ = Aⱼᵢ

Properties:
- (Aᵀ)ᵀ = A
- (A + B)ᵀ = Aᵀ + Bᵀ
- (AB)ᵀ = BᵀAᵀ

## Determinant

The determinant det(A) is a scalar value computed from a square matrix.

For a 2×2 matrix: det([a,b; c,d]) = ad - bc

Key properties:
- det(A) ≠ 0 ⟹ A is invertible
- det(AB) = det(A) · det(B)
- det(Aᵀ) = det(A)

## Eigenvalues & Eigenvectors

An eigenvector **v** of matrix A satisfies: A**v** = λ**v**

where λ is the corresponding eigenvalue. Found by solving det(A - λI) = 0.`,
        userId,
      })
      .returning({ id: materials.id }).all();

    const [bayesMaterial] = db
      .insert(materials)
      .values({
        title: "Bayes' Theorem Explained",
        description: "Understanding Bayesian reasoning with examples",
        content: `# Bayes' Theorem

## The Formula

P(A|B) = P(B|A) · P(A) / P(B)

Where:
- P(A|B) = **posterior** — probability of A given B
- P(B|A) = **likelihood** — probability of B given A
- P(A) = **prior** — initial probability of A
- P(B) = **evidence** — total probability of B

## Intuitive Example: Medical Testing

Suppose a disease affects 1% of the population. A test has:
- 99% sensitivity (true positive rate): P(+|disease) = 0.99
- 95% specificity (true negative rate): P(-|no disease) = 0.95

If you test positive, what's the probability you have the disease?

P(disease|+) = P(+|disease) · P(disease) / P(+)

P(+) = P(+|disease)·P(disease) + P(+|no disease)·P(no disease)
P(+) = 0.99 × 0.01 + 0.05 × 0.99 = 0.0099 + 0.0495 = 0.0594

P(disease|+) = 0.0099 / 0.0594 ≈ **16.7%**

Despite a 99% accurate test, a positive result only means ~17% chance of disease! This is because the disease is rare (low prior).

## Applications in ML

- **Naive Bayes classifier**: Assumes feature independence to classify data
- **Bayesian inference**: Updating model parameters as new data arrives
- **Spam filtering**: P(spam|words) using word frequencies`,
        userId,
      })
      .returning({ id: materials.id }).all();

    const [distributionsMaterial] = db
      .insert(materials)
      .values({
        title: "Probability Distributions Overview",
        description: "Key probability distributions and when to use them",
        content: `# Probability Distributions

## Discrete Distributions

### Bernoulli Distribution
- Single trial, two outcomes (success/failure)
- P(X=1) = p, P(X=0) = 1-p
- Mean: p, Variance: p(1-p)

### Binomial Distribution
- n independent Bernoulli trials
- P(X=k) = C(n,k) · pᵏ · (1-p)ⁿ⁻ᵏ
- Mean: np, Variance: np(1-p)

### Poisson Distribution
- Events in a fixed interval
- P(X=k) = (λᵏ · e⁻ᵝ) / k!
- Mean: λ, Variance: λ

### Geometric Distribution
- Trials until first success
- P(X=k) = (1-p)ᵏ⁻¹ · p
- Mean: 1/p

## Continuous Distributions

### Normal (Gaussian) Distribution
- Bell-shaped, symmetric around mean
- Defined by μ (mean) and σ (standard deviation)
- 68-95-99.7 rule
- Central Limit Theorem: sum of many independent variables → normal

### Exponential Distribution
- Time between events in a Poisson process
- f(x) = λe⁻ᵝˣ for x ≥ 0
- Mean: 1/λ, Variance: 1/λ²
- Memoryless property

### Uniform Distribution
- Equal probability over an interval [a, b]
- f(x) = 1/(b-a)
- Mean: (a+b)/2

## Choosing the Right Distribution

| Scenario | Distribution |
|----------|-------------|
| Coin flip | Bernoulli |
| Multiple coin flips | Binomial |
| Events per hour | Poisson |
| Time until next event | Exponential |
| Measurements with error | Normal |
| Random number in range | Uniform |`,
        userId,
      })
      .returning({ id: materials.id }).all();

    // Link materials to decks
    db.insert(materialDecks).values([
      { materialId: vectorsMaterial.id, deckId: vectorsDeck.id },
      { materialId: matricesMaterial.id, deckId: matricesDeck.id },
      { materialId: bayesMaterial.id, deckId: probDeck.id },
      { materialId: distributionsMaterial.id, deckId: distDeck.id },
    ]).run();

    // 7. More quiz questions for standalone quizzes
    const [sq1] = db
      .insert(quizQuestions)
      .values({
        deckId: vectorsDeck.id,
        quizId: linAlgQuiz.id,
        type: "multiple_choice",
        question: "What is the dimension of the vector space ℝ³?",
        explanation: "ℝ³ has dimension 3 because its standard basis {e₁, e₂, e₃} contains 3 vectors.",
      })
      .returning({ id: quizQuestions.id }).all();

    db.insert(questionOptions).values([
      { questionId: sq1.id, optionText: "3", isCorrect: true },
      { questionId: sq1.id, optionText: "2", isCorrect: false },
      { questionId: sq1.id, optionText: "1", isCorrect: false },
      { questionId: sq1.id, optionText: "Infinite", isCorrect: false },
    ]).run();

    const [sq2] = db
      .insert(quizQuestions)
      .values({
        deckId: matricesDeck.id,
        quizId: linAlgQuiz.id,
        type: "true_false",
        question: "Matrix multiplication is commutative (AB = BA for all matrices).",
        explanation: "Matrix multiplication is NOT commutative. AB ≠ BA in general.",
      })
      .returning({ id: quizQuestions.id }).all();

    db.insert(questionOptions).values([
      { questionId: sq2.id, optionText: "True", isCorrect: false },
      { questionId: sq2.id, optionText: "False", isCorrect: true },
    ]).run();

    db.insert(quizQuestions).values({
      deckId: vectorsDeck.id,
      quizId: linAlgQuiz.id,
      type: "free_text",
      question: "What is the name for a set of linearly independent vectors that span a vector space?",
      correctAnswer: JSON.stringify(["basis", "a basis"]),
      explanation: "A basis is a set of linearly independent vectors that span the entire vector space.",
    }).run();

    const [sq4] = db
      .insert(quizQuestions)
      .values({
        deckId: probDeck.id,
        quizId: probQuiz.id,
        type: "multiple_choice",
        question: "What is P(A ∪ B) for mutually exclusive events?",
        explanation: "For mutually exclusive events P(A ∩ B) = 0, so P(A ∪ B) = P(A) + P(B).",
      })
      .returning({ id: quizQuestions.id }).all();

    db.insert(questionOptions).values([
      { questionId: sq4.id, optionText: "P(A) + P(B)", isCorrect: true },
      { questionId: sq4.id, optionText: "P(A) × P(B)", isCorrect: false },
      { questionId: sq4.id, optionText: "P(A) + P(B) - P(A)P(B)", isCorrect: false },
      { questionId: sq4.id, optionText: "1 - P(A)P(B)", isCorrect: false },
    ]).run();

    const [sq5] = db
      .insert(quizQuestions)
      .values({
        deckId: distDeck.id,
        quizId: probQuiz.id,
        type: "true_false",
        question: "The Poisson distribution can only model events that occur at most once per interval.",
        explanation: "The Poisson distribution can model any number of events (0, 1, 2, ...) in a fixed interval.",
      })
      .returning({ id: quizQuestions.id }).all();

    db.insert(questionOptions).values([
      { questionId: sq5.id, optionText: "True", isCorrect: false },
      { questionId: sq5.id, optionText: "False", isCorrect: true },
    ]).run();

    db.insert(quizQuestions).values({
      deckId: distDeck.id,
      quizId: probQuiz.id,
      type: "matching",
      question: "Match each distribution to its key parameter(s):",
      correctAnswer: JSON.stringify([
        { left: "Normal", right: "μ (mean) and σ (std dev)" },
        { left: "Poisson", right: "λ (rate)" },
        { left: "Bernoulli", right: "p (success probability)" },
        { left: "Uniform", right: "a and b (interval bounds)" },
      ]),
      explanation: "Each distribution is defined by its characteristic parameters.",
    }).run();

    // Link quizzes to materials
    db.insert(materialQuizzes).values([
      { materialId: vectorsMaterial.id, quizId: linAlgQuiz.id },
      { materialId: bayesMaterial.id, quizId: probQuiz.id },
    ]).run();

    // 8. Add materials and quizzes as course steps
    db.insert(courseSteps).values([
      { courseId: linearAlgebra.id, position: 0, stepType: "material", materialId: vectorsMaterial.id },
      { courseId: linearAlgebra.id, position: 1, stepType: "material", materialId: matricesMaterial.id },
      { courseId: linearAlgebra.id, position: 2, stepType: "quiz", quizId: linAlgQuiz.id },
    ]).run();

    db.insert(courseSteps).values([
      { courseId: probStats.id, position: 0, stepType: "material", materialId: bayesMaterial.id },
      { courseId: probStats.id, position: 1, stepType: "material", materialId: distributionsMaterial.id },
      { courseId: probStats.id, position: 2, stepType: "quiz", quizId: probQuiz.id },
    ]).run();

    console.log("\nSeeded data:");
    console.log("  Course: AI/ML");
    console.log("    Subcourse: Linear Algebra");
    console.log("      - 2 decks, 6 flashcards, 5 deck quiz questions");
    console.log("      - 2 materials (Intro to Vectors, Matrix Operations)");
    console.log("      - 1 standalone quiz (Linear Algebra Fundamentals, 3 questions)");
    console.log("      - 3 course steps (2 materials + 1 quiz)");
    console.log("    Subcourse: Probability & Statistics");
    console.log("      - 2 decks, 5 flashcards, 5 deck quiz questions");
    console.log("      - 2 materials (Bayes' Theorem, Distributions Overview)");
    console.log("      - 1 standalone quiz (Probability Assessment, 3 questions)");
    console.log("      - 3 course steps (2 materials + 1 quiz)");
    console.log("\nDone!");
  } finally {
    closeDb();
  }
}

main();
