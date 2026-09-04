/**
 * Create_Forms.gs — generates a Google Form for each A level course, one
 * question per skill, ready to set as a reflective task in Google Classroom.
 *
 * WHY: students self-assess each skill 1/2/3 privately (Form responses are only
 * visible to you). Because it's "one Form per course", pupils can SKIP any topic
 * not yet taught — every skill question is optional, so unseen skills are simply
 * left blank and the report treats them as "not seen".
 *
 * HOW TO USE
 *   1. script.google.com -> New project. Paste this whole file in. Save.
 *   2. Run  createAllForms   (or one of the createX functions for a single course).
 *   3. Approve permissions on first run (it only creates Forms in your Drive).
 *   4. The log (View -> Logs) prints each Form's edit + responder links.
 *   5. In each Form: Responses tab -> link to Sheets if you like; then in
 *      Google Classroom attach the Form as an assignment.
 *   6. When responses are in: File -> Download -> .csv  (or from the linked
 *      Sheet), then upload that CSV to the Core Pure / A level tracker page.
 *
 * The skill list below mirrors the trackers exactly, so the CSV column headers
 * line up with the report engine (each question starts with the skill code).
 */

/* ===== EDIT: your class/course setup ===== */
var COLLECT_EMAIL = true;   // capture school email automatically (recommended)
var ADD_NAME_QUESTION = true; // also ask for full name (handy if emails aren't tidy)

/* ===== SKILL DATA (mirrors the trackers) ===== */
var COURSES = {
  "AS Pure": AS_PURE(),
  "AS Applied": AS_APPLIED(),
  "A level Pure": ALEVEL_PURE(),
  "A level Applied": ALEVEL_APPLIED(),
  "Core Pure 1": CORE_PURE()
};

function createAllForms() {
  var ok = 0, fail = 0;
  Object.keys(COURSES).forEach(function (name) {
    try { createForm_(name, COURSES[name]); ok++; }
    catch (e) { fail++; Logger.log("FAILED: " + name + " — " + (e && e.message ? e.message : e)); }
  });
  Logger.log("Done. " + ok + " form(s) created" + (fail ? ", " + fail + " failed (see above)." : "."));
}
function createAS_Pure(){ createForm_("AS Pure", COURSES["AS Pure"]); }
function createAS_Applied(){ createForm_("AS Applied", COURSES["AS Applied"]); }
function createALevel_Pure(){ createForm_("A level Pure", COURSES["A level Pure"]); }
function createALevel_Applied(){ createForm_("A level Applied", COURSES["A level Applied"]); }
function createCore_Pure(){ createForm_("Core Pure 1", COURSES["Core Pure 1"]); }

function createForm_(courseName, chapters) {
  var form = FormApp.create(courseName + " - Skills Self-Reflection");
  form.setDescription(
    "Rate how confident you feel with each skill:\n" +
    "1 = I need more work   ·   2 = Getting there   ·   3 = Confident\n\n" +
    "Only answer the topics we've covered — leave anything we haven't done yet blank."
  );
  if (COLLECT_EMAIL) {
    try { form.setCollectEmail(true); }
    catch (e) { Logger.log("   (Note: couldn't auto-collect email on this account — a name question is used instead.)"); }
  }
  try { form.setAllowResponseEdits(true); } catch (e) {}
  try { form.setLimitOneResponsePerUser(false); } catch (e) {}

  if (ADD_NAME_QUESTION) {
    form.addTextItem().setTitle("Full name").setRequired(true);
  }

  chapters.forEach(function (ch) {
    // section header per chapter so pupils can jump/skip by topic
    form.addSectionHeaderItem()
      .setTitle("Chapter " + ch.code + ": " + ch.name)
      .setHelpText("Skip this chapter if we haven't covered it yet.");
    ch.skills.forEach(function (sk, i) {
      var code = ch.code + "." + (i + 1);
      var item = form.addMultipleChoiceItem();
      item.setTitle(code + "  " + sk)
          .setRequired(false)   // optional -> unseen skills stay blank
          .setChoiceValues(["1 \u2013 Need more work", "2 \u2013 Getting there", "3 \u2013 Confident"]);
    });
  });

  Logger.log(courseName + ":");
  Logger.log("   Edit:    " + form.getEditUrl());
  Logger.log("   Share:   " + form.getPublishedUrl());
}

/* ===== SKILL DATA (code order matches the trackers) ===== */
function AS_PURE() { return [{"code": "1", "name": "Algebraic expressions", "skills": ["Index laws", "Expanding brackets", "Factorising", "Negative & fractional indices", "Surds", "Rationalising denominators"]}, {"code": "2", "name": "Quadratics", "skills": ["Solving quadratics", "Completing the square", "Quadratic functions & graphs", "The discriminant", "Modelling with quadratics"]}, {"code": "3", "name": "Equations & inequalities", "skills": ["Simultaneous equations (linear)", "Simultaneous (one quadratic)", "Linear inequalities", "Quadratic inequalities", "Inequalities on graphs", "Regions"]}, {"code": "4", "name": "Graphs & transformations", "skills": ["Cubic graphs", "Quartic graphs", "Reciprocal graphs", "Points of intersection", "Translations f(x+a), f(x)+a", "Stretches", "Transforming functions"]}, {"code": "5", "name": "Straight line graphs", "skills": ["y=mx+c", "Equation of a line", "Parallel & perpendicular", "Length & midpoint", "Modelling with straight lines"]}, {"code": "6", "name": "Circles", "skills": ["Midpoint & perpendicular bisector", "Equation of a circle", "Intersections of line & circle", "Tangent & chord properties", "Circle & triangle problems"]}, {"code": "7", "name": "Algebraic methods", "skills": ["Algebraic fractions", "Dividing polynomials", "The factor theorem", "Proof (deduction, exhaustion, counter-example)"]}, {"code": "8", "name": "The binomial expansion", "skills": ["Pascal's triangle", "Factorial notation & nCr", "Binomial expansion", "Using the expansion", "Estimation"]}, {"code": "9", "name": "Trigonometric ratios", "skills": ["The cosine rule", "The sine rule", "Areas of triangles", "Solving triangle problems", "Graphs of sin, cos, tan", "Transforming trig graphs"]}, {"code": "10", "name": "Trigonometric identities & equations", "skills": ["Exact trig values", "tan = sin/cos identity", "sin²+cos²=1 identity", "Solving trig equations", "Harder trig equations"]}, {"code": "11", "name": "Vectors", "skills": ["Vectors & representation", "Magnitude & direction", "Position vectors", "Vectors in geometry", "Modelling with vectors"]}, {"code": "12", "name": "Differentiation", "skills": ["Gradients of curves", "Differentiation from first principles", "Differentiating x^n", "Second derivatives", "Tangents & normals", "Increasing/decreasing functions", "Stationary points", "Modelling with differentiation"]}, {"code": "13", "name": "Integration", "skills": ["Integrating x^n", "Indefinite integrals", "Finding f(x) given f'(x)", "Definite integrals", "Area under a curve", "Areas between curves & lines"]}, {"code": "14", "name": "Exponentials & logarithms", "skills": ["Exponential functions", "The number e", "Logarithms & laws", "Solving equations with logs", "Working with natural logs", "Modelling with exponentials & logs"]}]; }

function AS_APPLIED() { return [{"code": "1", "name": "Data collection", "skills": ["Populations & samples", "Sampling methods", "Non-random sampling", "Types of data", "The large data set"]}, {"code": "2", "name": "Measures of location & spread", "skills": ["Mean, median, mode", "Quartiles & percentiles", "Range & interquartile range", "Variance & standard deviation", "Coding"]}, {"code": "3", "name": "Representations of data", "skills": ["Outliers", "Box plots", "Cumulative frequency", "Histograms", "Comparing data"]}, {"code": "4", "name": "Correlation", "skills": ["Correlation", "Linear regression", "Using regression lines"]}, {"code": "5", "name": "Probability", "skills": ["Sample spaces & Venn diagrams", "Mutually exclusive & independent events", "Tree diagrams"]}, {"code": "6", "name": "Statistical distributions", "skills": ["Probability distributions", "The binomial distribution", "Cumulative binomial probabilities"]}, {"code": "7", "name": "Hypothesis testing", "skills": ["Hypotheses", "Finding critical values", "One-tailed tests", "Two-tailed tests"]}, {"code": "8", "name": "Modelling in mechanics", "skills": ["Constructing a model", "Modelling assumptions", "Quantities & units", "Working with vectors in mechanics"]}, {"code": "9", "name": "Constant acceleration", "skills": ["Displacement–time graphs", "Velocity–time graphs", "Constant acceleration formulae (suvat)", "Vertical motion under gravity"]}, {"code": "10", "name": "Forces & motion", "skills": ["Force diagrams", "Forces as vectors", "Newton's 1st & 2nd laws", "Connected particles", "Pulleys"]}, {"code": "11", "name": "Variable acceleration", "skills": ["Functions of time", "Using differentiation", "Using integration", "Constant acceleration via calculus"]}]; }

function ALEVEL_PURE() { return [{"code": "1", "name": "Algebraic methods", "skills": ["Proof by contradiction", "Algebraic fractions", "Partial fractions", "Repeated factors", "Algebraic division"]}, {"code": "2", "name": "Functions & graphs", "skills": ["The modulus function", "Functions & mappings", "Composite functions", "Inverse functions", "y=|f(x)| and y=f(|x|)", "Combining transformations", "Solving modulus problems"]}, {"code": "3", "name": "Sequences & series", "skills": ["Arithmetic sequences", "Arithmetic series", "Geometric sequences", "Geometric series", "Sum to infinity", "Sigma notation", "Recurrence relations", "Modelling with series"]}, {"code": "4", "name": "Binomial expansion", "skills": ["Expanding (1+x)^n for any n", "Expanding (a+bx)^n", "Using partial fractions with expansions"]}, {"code": "5", "name": "Radians", "skills": ["Radian measure", "Arc length", "Sector area", "Solving trig equations in radians", "Small angle approximations"]}, {"code": "6", "name": "Trigonometric functions", "skills": ["Secant, cosecant & cotangent", "Graphs of reciprocal trig", "Inverse trig functions", "Using sec/cosec/cot identities"]}, {"code": "7", "name": "Trigonometry & modelling", "skills": ["Addition formulae", "Double angle formulae", "Solving equations with these", "R cos/sin form", "Proving identities", "Modelling with trig"]}, {"code": "8", "name": "Parametric equations", "skills": ["Parametric equations", "Converting to Cartesian", "Curve sketching", "Points of intersection", "Modelling with parametrics"]}, {"code": "9", "name": "Differentiation", "skills": ["Differentiating sin, cos, e^x, ln x", "Chain rule", "Product rule", "Quotient rule", "Implicit differentiation", "Parametric differentiation", "Rates of change"]}, {"code": "10", "name": "Numerical methods", "skills": ["Locating roots", "Iteration", "Newton–Raphson", "Applications to models"]}, {"code": "11", "name": "Integration", "skills": ["Standard integrals", "Integrating f(ax+b)", "Using trig identities", "Reverse chain rule", "Integration by substitution", "Integration by parts", "Partial fractions", "Areas", "Trapezium rule", "Differential equations"]}, {"code": "12", "name": "Vectors (3D)", "skills": ["3D coordinates", "Vectors in 3D", "Magnitude & unit vectors", "Position vectors & distances", "Geometric problems in 3D"]}]; }

function ALEVEL_APPLIED() { return [{"code": "1", "name": "Regression, correlation & hypothesis testing", "skills": ["Exponential models", "Measuring correlation (PMCC)", "Hypothesis testing for zero correlation"]}, {"code": "2", "name": "Conditional probability", "skills": ["Set notation", "Conditional probability", "Probability formulae", "Tree diagrams with conditionals"]}, {"code": "3", "name": "The normal distribution", "skills": ["The normal distribution", "Finding probabilities", "The inverse normal", "Standard normal & z-values", "Finding μ and σ", "Normal approximation to binomial", "Hypothesis testing with the normal"]}, {"code": "4", "name": "Moments", "skills": ["Moments", "Resultant moments", "Equilibrium", "Centres of mass", "Tilting"]}, {"code": "5", "name": "Forces & friction", "skills": ["Resolving forces", "Inclined planes", "Friction & the coefficient μ"]}, {"code": "6", "name": "Projectiles", "skills": ["Horizontal projection", "Horizontal & vertical components", "Projectile formulae", "Range, time & greatest height"]}, {"code": "7", "name": "Applications of forces", "skills": ["Static particles", "Modelling with statics", "Friction & static particles", "Static rigid bodies", "Dynamics & inclined planes", "Connected particles"]}, {"code": "8", "name": "Further kinematics", "skills": ["Vectors in kinematics", "Vectors with calculus", "Projectiles as vectors", "Variable acceleration in 2D"]}]; }

function CORE_PURE() { return [{"code": "1", "name": "Complex numbers", "skills": ["Imaginary & complex numbers", "Multiplying complex numbers", "Complex conjugation", "Roots of quadratic equations", "Solving cubic & quartic equations"]}, {"code": "2", "name": "Argand diagrams", "skills": ["Argand diagrams", "Modulus & argument", "Modulus–argument form", "Multiplying & dividing in mod–arg form", "Loci in the Argand plane", "Regions in the Argand plane"]}, {"code": "3", "name": "Series", "skills": ["Sums of natural numbers Σr", "Sums of squares Σr² & cubes Σr³", "Using standard results", "Method of differences"]}, {"code": "4", "name": "Roots of polynomials", "skills": ["Roots of a quadratic", "Roots of a cubic", "Roots of a quartic", "Expressions relating roots", "Linear transformations of roots"]}, {"code": "5", "name": "Volumes of revolution", "skills": ["Rotation about the x-axis", "Rotation about the y-axis", "Volumes of revolution around lines", "Modelling with volumes"]}, {"code": "6", "name": "Matrices", "skills": ["Introduction to matrices", "Matrix multiplication", "Determinants", "Inverting a 2×2 matrix", "Inverting a 3×3 matrix", "Solving systems of equations"]}, {"code": "7", "name": "Linear transformations", "skills": ["Linear transformations in 2D", "Reflections & rotations", "Enlargements & stretches", "Successive transformations", "The determinant as area scale factor", "Transformations in 3D", "Invariant points & lines"]}, {"code": "8", "name": "Proof by induction", "skills": ["Proof by induction (summation)", "Proof by induction (divisibility)", "Proof by induction (matrices)", "Proof by induction (recurrence)"]}, {"code": "9", "name": "Vectors", "skills": ["Equation of a line in 3D", "Equation of a plane", "Scalar product", "Angles between lines & planes", "Points of intersection", "Distances (point to line/plane)"]}]; }
