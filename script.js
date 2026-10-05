const PROXY_URL = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
const IMAGE_MODEL = "google/nano-banana-2";
const LOCAL_STORAGE_KEY = "recipe-shelf-recipes-v1";
const AUTHOR_STORAGE_KEY = "recipe-shelf-author";
const USER_STORAGE_KEY = "recipe-shelf-person-id";
const ROW_SIZE = 4;
const INITIAL_VISIBLE_ROWS = 3;
const firebaseConfig = window.recipeShelfFirebaseConfig || {};
const BACKDROP_PATTERNS = ["pattern-lines", "pattern-grid", "pattern-dots"];
const BACKDROP_PALETTES = [
  { base: "#efbd45", mark: "#f8d975", grain: "#8f5b2e" },
  { base: "#e7a0a4", mark: "#f6c4ba", grain: "#934e58" },
  { base: "#9fbd9b", mark: "#d7dfba", grain: "#526e51" },
  { base: "#87b8c2", mark: "#c7d9cf", grain: "#486d75" },
  { base: "#e99b69", mark: "#f6c998", grain: "#934f38" },
  { base: "#c3a4c2", mark: "#ead1cf", grain: "#73506f" }
];
const STAR_PALETTES = [
  { fill: "#e75f4f", edge: "#873c35" },
  { fill: "#edb82f", edge: "#89632c" },
  { fill: "#df7da3", edge: "#864b65" },
  { fill: "#6f9e78", edge: "#3f6749" },
  { fill: "#5e91b4", edge: "#3f6075" },
  { fill: "#b27baa", edge: "#6d4c69" },
  { fill: "#e98857", edge: "#914f35" }
];

const state = {
  recipes: [],
  mode: "local",
  recipesRef: null,
  firebase: null,
  ratingMode: false,
  pendingRatingMode: false,
  personId: getOrCreatePersonId(),
  activeRecipeId: null,
  searchQuery: "",
  category: "all",
  sort: "newest",
  visibleRows: INITIAL_VISIBLE_ROWS,
  isSaving: false
};

const shelfList = document.getElementById("shelf-list");
const emptyState = document.getElementById("empty-state");
const emptyMessage = document.getElementById("empty-message");
const recipeSearch = document.getElementById("recipe-search");
const categoryFilters = document.getElementById("category-filters");
const recipeSort = document.getElementById("recipe-sort");
const recipeCount = document.getElementById("recipe-count");
const loadMoreButton = document.getElementById("load-more");
const storageStatus = document.getElementById("storage-status");
const identityButton = document.getElementById("identity-button");
const identityName = document.getElementById("identity-name");
const identityDialog = document.getElementById("identity-dialog");
const identityForm = document.getElementById("identity-form");
const identityInput = document.getElementById("identity-input");
const ratingButton = document.getElementById("toggle-rating");
const ratingButtonLabel = ratingButton.querySelector(".rating-button-label");
const ratingHint = document.getElementById("rating-hint");
const openFormButton = document.getElementById("open-form");
const formDialog = document.getElementById("recipe-form-dialog");
const form = document.getElementById("recipe-form");
const authorInput = document.getElementById("author-input");
const titleInput = document.getElementById("title-input");
const storyInput = document.getElementById("story-input");
const ingredientsInput = document.getElementById("ingredients-input");
const instructionsInput = document.getElementById("instructions-input");
const submitButton = document.getElementById("submit-recipe");
const formMessage = document.getElementById("form-message");
const detailDialog = document.getElementById("recipe-detail-dialog");
const detailMeta = document.getElementById("detail-meta");
const detailTitle = document.getElementById("detail-title");
const detailStorySection = document.getElementById("detail-story-section");
const detailStory = document.getElementById("detail-story");
const detailIngredients = document.getElementById("detail-ingredients");
const detailInstructions = document.getElementById("detail-instructions");
const ownerActions = document.getElementById("owner-actions");
const deleteRecipeButton = document.getElementById("delete-recipe");
const recipeCopy = document.querySelector(".recipe-copy");
const detailArt = document.querySelector(".detail-art");
const detailDish = document.getElementById("detail-dish");
const detailImage = document.getElementById("detail-image");
const cardTemplate = document.getElementById("recipe-card-template");

init();

async function init() {
  bindEvents();
  authorInput.value = getSavedAuthor();
  updateIdentityUI();
  await connectDataLayer();
}

function bindEvents() {
  openFormButton.addEventListener("click", () => formDialog.showModal());
  identityButton.addEventListener("click", openIdentityDialog);
  identityForm.addEventListener("submit", saveIdentity);
  recipeSearch.addEventListener("input", updateSearch);
  categoryFilters.addEventListener("click", updateCategory);
  recipeSort.addEventListener("change", updateSort);
  loadMoreButton.addEventListener("click", loadMoreRecipes);
  ratingButton.addEventListener("click", requestRatingMode);
  document.querySelector("[data-close-identity]").addEventListener("click", closeIdentityDialog);
  document.querySelector("[data-close-form]").addEventListener("click", () => formDialog.close());
  document.querySelector("[data-close-detail]").addEventListener("click", () => detailDialog.close());
  deleteRecipeButton.addEventListener("click", deleteActiveRecipe);
  form.addEventListener("submit", handleSubmit);
  detailArt.addEventListener("wheel", event => {
    if (recipeCopy.scrollHeight <= recipeCopy.clientHeight) return;
    event.preventDefault();
    recipeCopy.scrollTop += event.deltaY;
  }, { passive: false });

  for (const dialog of [identityDialog, formDialog, detailDialog]) {
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      if (dialog === identityDialog) closeIdentityDialog();
      else dialog.close();
    });
  }
}

function updateSearch() {
  state.searchQuery = recipeSearch.value.trim().toLowerCase();
  state.visibleRows = INITIAL_VISIBLE_ROWS;
  renderShelf();
}

function updateCategory(event) {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  state.visibleRows = INITIAL_VISIBLE_ROWS;
  categoryFilters.querySelectorAll("button[data-category]").forEach(item => {
    item.setAttribute("aria-pressed", String(item === button));
  });
  renderShelf();
}

function updateSort() {
  state.sort = recipeSort.value;
  state.visibleRows = INITIAL_VISIBLE_ROWS;
  renderShelf();
}

function loadMoreRecipes() {
  state.visibleRows += 2;
  renderShelf();
}

function openIdentityDialog() {
  identityInput.value = getSavedAuthor();
  identityDialog.showModal();
  identityInput.focus();
}

function closeIdentityDialog() {
  state.pendingRatingMode = false;
  identityDialog.close();
}

function saveIdentity(event) {
  event.preventDefault();
  const name = identityInput.value.trim();
  if (!name) return;
  localStorage.setItem(AUTHOR_STORAGE_KEY, name);
  authorInput.value = name;
  updateIdentityUI();
  identityDialog.close();
  if (state.pendingRatingMode) {
    state.pendingRatingMode = false;
    toggleRatingMode();
  }
}

function updateIdentityUI() {
  const name = getSavedAuthor();
  identityName.textContent = name || "Set your name";
  identityButton.classList.toggle("has-name", Boolean(name));
  identityButton.setAttribute("aria-label", name ? `Cooking as ${name}. Change name` : "Set your cook name");
}

function requestRatingMode() {
  if (!state.ratingMode && !getSavedAuthor()) {
    state.pendingRatingMode = true;
    openIdentityDialog();
    return;
  }
  toggleRatingMode();
}

function toggleRatingMode() {
  state.ratingMode = !state.ratingMode;
  document.body.classList.toggle("rating-mode", state.ratingMode);
  ratingButton.setAttribute("aria-pressed", String(state.ratingMode));
  ratingButtonLabel.textContent = state.ratingMode ? "Finish starring" : "Add a star";
  ratingHint.textContent = state.ratingMode
    ? "Choose a recipe, then click or drag to place your star nearby."
    : "Your stars are saved. Turn rating mode on whenever you want to move one.";
}

async function connectDataLayer() {
  const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);

  if (!configured) {
    state.mode = "local";
    state.recipes = readLocalRecipes();
    storageStatus.textContent = "Local preview · add Firebase to share";
    renderShelf();
    return;
  }

  try {
    const [appModule, databaseModule, authModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")
    ]);
    const app = appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const credential = await authModule.signInAnonymously(auth);
    const database = databaseModule.getDatabase(app);
    state.mode = "firebase";
    state.personId = credential.user.uid;
    state.firebase = databaseModule;
    state.recipesRef = databaseModule.ref(database, "recipeShelf/recipes");
    storageStatus.textContent = "Live community shelf";

    databaseModule.onValue(state.recipesRef, snapshot => {
      const value = snapshot.val() || {};
      state.recipes = Object.entries(value).map(([id, recipe]) => ({ id, ...recipe }));
      renderShelf();
    }, error => {
      console.error("Firebase subscription failed", error);
      storageStatus.textContent = "Firebase could not load · using local preview";
      state.mode = "local";
      state.recipes = readLocalRecipes();
      renderShelf();
    });
  } catch (error) {
    console.error("Firebase setup failed", error);
    state.mode = "local";
    state.recipes = readLocalRecipes();
    storageStatus.textContent = "Firebase setup needed · using local preview";
    renderShelf();
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.isSaving) return;

  const author = authorInput.value.trim();
  const title = titleInput.value.trim();
  const story = storyInput.value.trim();
  const ingredients = splitLines(ingredientsInput.value);
  const instructions = instructionsInput.value.trim();
  const dishType = new FormData(form).get("dishType") || "blue-bowl";
  const category = new FormData(form).get("category") || "other";

  if (!author || !title || ingredients.length === 0 || !instructions) return;

  setSaving(true, "Painting your food…");
  localStorage.setItem(AUTHOR_STORAGE_KEY, author);
  updateIdentityUI();

  try {
    const image = await generateFoodIllustration({ title, ingredients });
    const recipe = {
      author,
      ownerId: state.personId,
      title,
      story,
      category,
      ingredients,
      instructions,
      dishType,
      imageUrl: image.url,
      imageSource: image.source,
      createdAt: Date.now()
    };

    await saveRecipe(recipe);
    form.reset();
    authorInput.value = author;
    form.querySelector('input[value="blue-bowl"]').checked = true;
    form.querySelector('input[name="category"][value="main"]').checked = true;
    formDialog.close();
  } catch (error) {
    console.error(error);
    formMessage.textContent = "The recipe could not be added. Please try again.";
    formMessage.classList.add("error");
  } finally {
    setSaving(false);
  }
}

async function saveRecipe(recipe) {
  if (state.mode === "firebase" && state.recipesRef && state.firebase) {
    const newRecipeRef = state.firebase.push(state.recipesRef);
    await state.firebase.set(newRecipeRef, recipe);
    return;
  }

  state.recipes.push({ id: `local-${Date.now()}`, ...recipe });
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.recipes));
  renderShelf();
}

async function generateFoodIllustration({ title, ingredients }) {
  const shortIngredients = ingredients.slice(0, 8).join(", ");
  const prompt = `
Create a charming hand-painted editorial food illustration of ${title}, made with these visible ingredients when appropriate: ${shortIngredients}.

Show only the prepared food, viewed mostly from above and centered as one compact serving. Do not include a plate, bowl, cup, cutlery, table, hands, text, labels, logo, frame, or border. The website will place this food inside a separate illustrated dish.

Visual style: handmade 1960s editorial collage, matte gouache and cut-paper shapes, colored-pencil hatching, uneven painted edges, subtle risograph speckles and scanned paper grain. Use simplified playful forms and a restrained palette of tomato red, mustard yellow, leaf green, dusty blue, soft pink, cream and charcoal. It must feel tactile, imperfect and gently hand drawn—not photorealistic, not 3D, not glossy, and not like clean vector art.

Background: one plain, uninterrupted warm cream color close to #eee5d3, with no scenery or cast shadow. Keep the food safely inside the central 70 percent of a square image. No text.
  `.trim();

  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        input: {
          prompt,
          aspect_ratio: "1:1",
          resolution: "1K",
          output_format: "jpg"
        }
      })
    });

    if (!response.ok) throw new Error(`Image request failed with ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    const output = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!output) throw new Error("No image returned");
    const durableImage = await compressRemoteImage(output).catch(() => output);
    return { url: durableImage, source: "ai" };
  } catch (error) {
    console.warn("Using illustrated fallback", error);
    return { url: createFallbackFood(title), source: "fallback" };
  }
}

async function compressRemoteImage(url) {
  if (url.startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not preserve generated image");
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const maximumSide = 640;
  const scale = Math.min(1, maximumSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", .82);
}

function createFallbackFood(title) {
  const safeTitle = escapeXml(title.slice(0, 24));
  const colors = ["#ef5a42", "#efbd32", "#4a8e59", "#e7649c", "#2f76a8"];
  const pieces = Array.from({ length: 13 }, (_, index) => {
    const angle = (index / 13) * Math.PI * 2;
    const radius = 34 + (index % 3) * 13;
    const x = 150 + Math.cos(angle) * radius;
    const y = 145 + Math.sin(angle) * radius * .62;
    const color = colors[index % colors.length];
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${19 + index % 9}" ry="${12 + index % 7}" fill="${color}" stroke="#22251f" stroke-width="3" transform="rotate(${index * 17} ${x} ${y})"/>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#eee5d3"/><path d="M67 159c28-59 139-68 174 3-30 57-148 58-174-3Z" fill="#f5dfb3" stroke="#22251f" stroke-width="4"/>${pieces}<text x="150" y="260" text-anchor="middle" font-family="serif" font-size="17" fill="#22251f">${safeTitle}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderShelf() {
  const recipes = state.recipes
    .filter(recipeMatchesCurrentView)
    .sort(compareRecipes);
  const visibleLimit = state.visibleRows * ROW_SIZE;
  const visibleRecipes = recipes.slice(0, visibleLimit);
  shelfList.innerHTML = "";
  emptyState.classList.toggle("hidden", recipes.length > 0);
  emptyMessage.textContent = state.recipes.length === 0
    ? "The shelf is waiting for its first recipe."
    : "No recipes match this little note yet.";
  recipeCount.textContent = recipes.length === 0
    ? ""
    : `Showing ${visibleRecipes.length} of ${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`;
  loadMoreButton.classList.toggle("hidden", recipes.length <= visibleLimit);

  const rowCount = Math.max(3, Math.ceil(visibleRecipes.length / ROW_SIZE));
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const index = rowIndex * ROW_SIZE;
    const row = document.createElement("section");
    row.className = "shelf-row";
    row.setAttribute("aria-label", `Shelf ${rowIndex + 1}`);
    visibleRecipes.slice(index, index + ROW_SIZE).forEach((recipe, localIndex) => {
      row.appendChild(createRecipeCard(recipe, index + localIndex));
    });
    shelfList.appendChild(row);
  }
}

function recipeMatchesCurrentView(recipe) {
  const categoryMatches = state.category === "all" || getRecipeCategory(recipe) === state.category;
  if (!categoryMatches) return false;
  if (!state.searchQuery) return true;
  const searchableText = [
    recipe.title,
    recipe.author,
    recipe.story,
    ...(Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
  ].filter(Boolean).join(" ").toLowerCase();
  return searchableText.includes(state.searchQuery);
}

function compareRecipes(a, b) {
  if (state.sort === "most-made") {
    const starDifference = getStarCount(b) - getStarCount(a);
    if (starDifference !== 0) return starDifference;
  }
  return Number(b.createdAt || 0) - Number(a.createdAt || 0);
}

function getStarCount(recipe) {
  return recipe.stars && typeof recipe.stars === "object" ? Object.keys(recipe.stars).length : 0;
}

function getRecipeCategory(recipe) {
  const allowed = ["main", "sweet", "drink", "snack", "other"];
  if (allowed.includes(recipe.category)) return recipe.category;
  const text = [recipe.title, ...(Array.isArray(recipe.ingredients) ? recipe.ingredients : [])]
    .filter(Boolean).join(" ").toLowerCase();
  if (/\bpancakes?\b/.test(text)) {
    return /sugar|honey|syrup|chocolate|vanilla|sweet/.test(text) ? "sweet" : "main";
  }
  if (/pudding|\bcake\b|cookies?|brownie|dessert|custard|ice cream|tart|\bpie\b|sweet/.test(text)) return "sweet";
  if (/coffee|tea|juice|smoothie|latte|lemonade|cocktail|drink/.test(text)) return "drink";
  if (/snack|toast|cracker|chips|bites|dip/.test(text)) return "snack";
  return "main";
}

function createRecipeCard(recipe, index) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const openButton = card.querySelector(".recipe-open");
  const dish = card.querySelector(".dish-frame");
  const image = card.querySelector(".recipe-image");
  const ratingZone = card.querySelector(".rating-zone");

  dish.classList.add(normalizeDishType(recipe.dishType));
  dish.style.setProperty("--tilt", `${((index % 5) - 2) * .8}deg`);
  image.src = recipe.imageUrl;
  image.alt = `${recipe.title} illustration`;
  card.querySelector(".recipe-title").textContent = recipe.title;
  card.querySelector(".recipe-byline").textContent = `by ${recipe.author} · ${formatDate(recipe.createdAt)}`;
  openButton.addEventListener("click", () => openRecipe(recipe));
  renderStars(ratingZone, recipe);
  ratingZone.addEventListener("pointerdown", event => beginStarPlacement(event, recipe, ratingZone));
  return card;
}

function renderStars(zone, recipe) {
  const stars = recipe.stars && typeof recipe.stars === "object" ? recipe.stars : {};
  Object.entries(stars).forEach(([ownerId, star]) => {
    const sticker = document.createElement("span");
    sticker.className = `star-sticker${ownerId === state.personId ? " is-mine" : ""}`;
    sticker.style.left = `${clamp(Number(star.x) || 50, 8, 92)}%`;
    sticker.style.top = `${clamp(Number(star.y) || 36, 6, 88)}%`;
    sticker.style.setProperty("--star-fill", star.fill || "#edb82f");
    sticker.style.setProperty("--star-edge", star.edge || "#89632c");
    sticker.style.setProperty("--star-turn", `${Number(star.rotation) || 0}deg`);
    sticker.title = ownerId === state.personId
      ? "Your star"
      : `${star.author || "A reader"} tried and liked this recipe`;
    zone.appendChild(sticker);
  });
}

function beginStarPlacement(event, recipe, zone) {
  if (!state.ratingMode) return;
  event.preventDefault();
  event.stopPropagation();

  const existing = recipe.stars?.[state.personId];
  const palette = existing || STAR_PALETTES[Math.floor(Math.random() * STAR_PALETTES.length)];
  const starData = {
    fill: palette.fill,
    edge: palette.edge,
    rotation: existing?.rotation ?? Math.round(Math.random() * 28 - 14),
    x: existing?.x ?? 50,
    y: existing?.y ?? 36
  };
  let sticker = zone.querySelector(".star-sticker.is-mine");

  if (!sticker) {
    sticker = document.createElement("span");
    sticker.className = "star-sticker is-mine";
    sticker.style.setProperty("--star-fill", starData.fill);
    sticker.style.setProperty("--star-edge", starData.edge);
    sticker.style.setProperty("--star-turn", `${starData.rotation}deg`);
    zone.appendChild(sticker);
  }

  const updatePosition = pointerEvent => {
    const bounds = zone.getBoundingClientRect();
    starData.x = clamp(((pointerEvent.clientX - bounds.left) / bounds.width) * 100, 8, 92);
    starData.y = clamp(((pointerEvent.clientY - bounds.top) / bounds.height) * 100, 6, 88);
    sticker.style.left = `${starData.x}%`;
    sticker.style.top = `${starData.y}%`;
  };

  updatePosition(event);
  zone.setPointerCapture(event.pointerId);
  zone.addEventListener("pointermove", updatePosition);
  zone.addEventListener("pointerup", finish, { once: true });
  zone.addEventListener("pointercancel", finish, { once: true });

  function finish() {
    zone.removeEventListener("pointermove", updatePosition);
    void saveStar(recipe, starData);
  }
}

async function saveStar(recipe, starData) {
  const savedStar = { ...starData, author: getSavedAuthor() || "A reader", updatedAt: Date.now() };

  if (state.mode === "firebase" && state.recipesRef && state.firebase) {
    const starRef = state.firebase.child(state.recipesRef, `${recipe.id}/stars/${state.personId}`);
    await state.firebase.set(starRef, savedStar);
    return;
  }

  const target = state.recipes.find(item => item.id === recipe.id);
  if (!target) return;
  target.stars = { ...(target.stars || {}), [state.personId]: savedStar };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.recipes));
  renderShelf();
}

function openRecipe(recipe) {
  state.activeRecipeId = recipe.id;
  detailMeta.textContent = `Shared by ${recipe.author} · ${formatDate(recipe.createdAt)}`;
  detailTitle.textContent = recipe.title;
  const story = typeof recipe.story === "string" ? recipe.story.trim() : "";
  detailStorySection.hidden = !story;
  detailStory.textContent = story;
  detailIngredients.innerHTML = "";
  (recipe.ingredients || []).forEach(ingredient => {
    const item = document.createElement("li");
    item.textContent = ingredient;
    detailIngredients.appendChild(item);
  });
  detailInstructions.textContent = recipe.instructions;
  ownerActions.hidden = !(recipe.ownerId && recipe.ownerId === state.personId);
  detailDish.className = `dish-frame large-dish ${normalizeDishType(recipe.dishType)}`;
  detailImage.src = recipe.imageUrl;
  detailImage.alt = `${recipe.title} illustration`;
  applyRandomDetailBackdrop();
  detailDialog.showModal();
  recipeCopy.scrollTop = 0;
}

async function deleteActiveRecipe() {
  const recipe = state.recipes.find(item => item.id === state.activeRecipeId);
  if (!recipe || recipe.ownerId !== state.personId) return;
  const shouldDelete = window.confirm(`Remove “${recipe.title}” from the shared shelf? This cannot be undone.`);
  if (!shouldDelete) return;

  if (state.mode === "firebase" && state.recipesRef && state.firebase) {
    const recipeRef = state.firebase.child(state.recipesRef, recipe.id);
    await state.firebase.remove(recipeRef);
  } else {
    state.recipes = state.recipes.filter(item => item.id !== recipe.id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.recipes));
    renderShelf();
  }

  state.activeRecipeId = null;
  detailDialog.close();
}

function applyRandomDetailBackdrop() {
  const pattern = BACKDROP_PATTERNS[Math.floor(Math.random() * BACKDROP_PATTERNS.length)];
  const palette = BACKDROP_PALETTES[Math.floor(Math.random() * BACKDROP_PALETTES.length)];

  detailArt.classList.remove(...BACKDROP_PATTERNS);
  detailArt.classList.add(pattern);
  detailArt.style.setProperty("--backdrop-base", palette.base);
  detailArt.style.setProperty("--backdrop-mark", palette.mark);
  detailArt.style.setProperty("--backdrop-grain", palette.grain);
}

function setSaving(isSaving, message = "AI will paint the food for your chosen dish.") {
  state.isSaving = isSaving;
  submitButton.disabled = isSaving;
  submitButton.textContent = isSaving ? "Painting…" : "Place it on the shelf";
  formMessage.textContent = message;
  formMessage.classList.remove("error");
}

function readLocalRecipes() {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function getSavedAuthor() {
  return (localStorage.getItem(AUTHOR_STORAGE_KEY) || "").trim();
}

function splitLines(value) {
  return value.split(/\n/).map(item => item.trim()).filter(Boolean);
}

function normalizeDishType(type) {
  return ["blue-bowl", "pink-plate", "green-bowl", "check-plate"].includes(type) ? type : "blue-bowl";
}

function formatDate(timestamp) {
  if (!timestamp) return "sometime";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}

function escapeXml(value) {
  return value.replace(/[<>&'\"]/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character]);
}

function getOrCreatePersonId() {
  const existing = localStorage.getItem(USER_STORAGE_KEY);
  if (existing) return existing;
  const generated = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `reader-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(USER_STORAGE_KEY, generated);
  return generated;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
