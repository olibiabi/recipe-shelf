const PROXY_URL = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
const IMAGE_MODEL = "google/nano-banana-2";
const EMBEDDING_VERSION = "beautyyuyanli/multilingual-e5-large:a06276a89f1a902d5fc225a9ca32b6e8e6292b7f3b136518878da97c458e2bad";
const LOCAL_STORAGE_KEY = "recipe-shelf-recipes-v1";
const AUTHOR_STORAGE_KEY = "recipe-shelf-author";
const USER_STORAGE_KEY = "recipe-shelf-person-id";
const SIMULATED_RATINGS_STORAGE_KEY = "recipe-shelf-simulated-ratings-v1";
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
  isSaving: false,
  simulatedRecipes: createSimulatedRecipes(),
  memoryMatches: [],
  returnToMemory: false
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
const openMemoryMapButton = document.getElementById("open-memory-map");
const memoryDialog = document.getElementById("memory-map-dialog");
const memorySearchForm = document.getElementById("memory-search-form");
const memoryQuery = document.getElementById("memory-query");
const memoryStatus = document.getElementById("memory-status");
const memoryResults = document.getElementById("memory-results");
const memoryNodes = document.getElementById("memory-nodes");
const memoryLines = document.getElementById("memory-lines");
const closestMemoryList = document.getElementById("closest-memory-list");
const findMemoryConnectionsButton = document.getElementById("find-memory-connections");
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
  openMemoryMapButton.addEventListener("click", openMemoryMap);
  memorySearchForm.addEventListener("submit", findMemoryConnections);
  document.querySelector("[data-close-identity]").addEventListener("click", closeIdentityDialog);
  document.querySelector("[data-close-form]").addEventListener("click", () => formDialog.close());
  document.querySelector("[data-close-detail]").addEventListener("click", closeRecipeDetail);
  document.querySelector("[data-close-memory]").addEventListener("click", () => memoryDialog.close());
  deleteRecipeButton.addEventListener("click", deleteActiveRecipe);
  form.addEventListener("submit", handleSubmit);
  detailArt.addEventListener("wheel", event => {
    if (recipeCopy.scrollHeight <= recipeCopy.clientHeight) return;
    event.preventDefault();
    recipeCopy.scrollTop += event.deltaY;
  }, { passive: false });

  for (const dialog of [identityDialog, formDialog, detailDialog, memoryDialog]) {
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      if (dialog === identityDialog) closeIdentityDialog();
      else if (dialog === detailDialog) closeRecipeDetail();
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
    return { url: createFallbackFood(title, ingredients), source: "fallback" };
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

function createFallbackFood(title, ingredients = []) {
  const seedText = `${title}|${ingredients.join("|")}`;
  const seed = Array.from(seedText).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
  const palettes = [
    ["#d95b43", "#efbd32", "#6e9356", "#e8a0af", "#ead8a8"],
    ["#7c3f36", "#e57b45", "#d9ad43", "#789662", "#f0d8b5"],
    ["#bd596f", "#ee9e4d", "#6d8d63", "#856592", "#ead7bb"],
    ["#c45a3c", "#d8a736", "#5e8c70", "#7692a5", "#edc99d"]
  ];
  const colors = palettes[seed % palettes.length];
  const form = seed % 4;
  const pieceCount = 7 + (seed % 8);
  const pieces = Array.from({ length: pieceCount }, (_, index) => {
    const value = (seed + index * 2654435761) >>> 0;
    const angle = ((index / pieceCount) * Math.PI * 2) + ((value % 23) / 31);
    const radius = 21 + (value % 46);
    const x = 150 + Math.cos(angle) * radius;
    const y = 149 + Math.sin(angle) * radius * .58;
    const rx = 12 + (value % 18);
    const ry = 8 + ((value >>> 5) % 16);
    const color = colors[(value >>> 9) % colors.length];
    if ((index + form) % 3 === 0) {
      return `<path d="M${(x-rx).toFixed(1)} ${y.toFixed(1)}q${rx.toFixed(1)} ${(-ry*1.7).toFixed(1)} ${(rx*2).toFixed(1)} 0q${(-rx*.2).toFixed(1)} ${(ry*1.9).toFixed(1)} ${(-rx*2).toFixed(1)} 0Z" fill="${color}" stroke="#34342e" stroke-width="2.6"/>`;
    }
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx}" ry="${ry}" fill="${color}" stroke="#34342e" stroke-width="2.6" transform="rotate(${value % 65 - 32} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }).join("");
  const bases = [
    `<path d="M66 160c30-58 139-65 170 2-29 54-142 59-170-2Z" fill="#ead8b4" stroke="#34342e" stroke-width="4"/>`,
    `<path d="M83 124c22-25 112-27 136 2l-13 76c-31 20-86 20-113-2Z" fill="#e7d4ad" stroke="#34342e" stroke-width="4"/>`,
    `<path d="M89 187c12-70 107-91 126-8-23 38-99 47-126 8Z" fill="#e8cfa2" stroke="#34342e" stroke-width="4"/>`,
    `<path d="M77 148q72-54 146 0l-18 57q-55 24-111-1Z" fill="#eddfbd" stroke="#34342e" stroke-width="4"/>`
  ];
  const garnish = `<path d="M145 98q9-25 25-31q-4 20-20 35M151 99q-13-21-30-22q8 19 26 26" fill="none" stroke="#64824f" stroke-width="6" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#eee5d3"/><g transform="rotate(${(seed % 7) - 3} 150 150)">${bases[form]}${form % 2 ? garnish : ""}${pieces}</g><g opacity=".18" fill="#34342e">${Array.from({ length: 28 }, (_, index) => `<circle cx="${28 + ((seed + index * 47) % 244)}" cy="${31 + ((seed + index * 71) % 226)}" r="${.7 + (index % 2) * .45}"/>`).join("")}</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function renderShelf() {
  const sourceRecipes = getAllRecipes();
  const recipes = sourceRecipes
    .filter(recipeMatchesCurrentView)
    .sort(compareRecipes);
  const visibleLimit = state.visibleRows * ROW_SIZE;
  const visibleRecipes = recipes.slice(0, visibleLimit);
  shelfList.innerHTML = "";
  emptyState.classList.toggle("hidden", recipes.length > 0);
  emptyMessage.textContent = sourceRecipes.length === 0
    ? "The shelf is waiting for its first recipe."
    : "No recipes match this little note yet.";
  recipeCount.textContent = recipes.length === 0
    ? ""
    : `Showing ${visibleRecipes.length} of ${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`;
  const remainingRecipeCount = Math.max(0, recipes.length - visibleRecipes.length);
  const nextRecipeCount = Math.min(ROW_SIZE * 2, remainingRecipeCount);
  loadMoreButton.classList.toggle("hidden", remainingRecipeCount === 0);
  loadMoreButton.textContent = remainingRecipeCount === 1
    ? "Show the last recipe"
    : `Show ${nextRecipeCount} more recipes`;

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

  card.classList.toggle("simulated-recipe", Boolean(recipe.isSimulated));

  dish.classList.add(normalizeDishType(recipe.dishType));
  dish.style.setProperty("--tilt", `${((index % 5) - 2) * .8}deg`);
  image.src = recipe.imageUrl;
  image.alt = `${recipe.title} illustration`;
  card.querySelector(".recipe-title").textContent = recipe.title;
  card.querySelector(".recipe-byline").textContent = recipe.isSimulated
    ? `by ${recipe.author} · simulated cook`
    : `by ${recipe.author} · ${formatDate(recipe.createdAt)}`;
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

  if (recipe.isSimulated) {
    const target = state.simulatedRecipes.find(item => item.id === recipe.id);
    if (!target) return;
    target.stars = { ...(target.stars || {}), [state.personId]: savedStar };
    saveSimulatedRating(recipe.id, state.personId, savedStar);
    renderShelf();
    return;
  }

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

function openRecipe(recipe, options = {}) {
  state.returnToMemory = Boolean(options.fromMemory);
  state.activeRecipeId = recipe.id;
  detailMeta.textContent = recipe.isSimulated
    ? `Simulated classroom recipe by ${recipe.author} · not a real person`
    : `Shared by ${recipe.author} · ${formatDate(recipe.createdAt)}`;
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
  ownerActions.hidden = Boolean(recipe.isSimulated) || !(recipe.ownerId && recipe.ownerId === state.personId);
  detailDish.className = `dish-frame large-dish ${normalizeDishType(recipe.dishType)}`;
  detailImage.src = recipe.imageUrl;
  detailImage.alt = `${recipe.title} illustration`;
  applyRandomDetailBackdrop();
  detailDialog.showModal();
  recipeCopy.scrollTop = 0;
}

function closeRecipeDetail() {
  detailDialog.close();
  if (!state.returnToMemory) return;
  state.returnToMemory = false;
  memoryDialog.showModal();
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

function openMemoryMap() {
  memoryDialog.showModal();
  window.setTimeout(() => memoryQuery.focus(), 80);
}

async function findMemoryConnections(event) {
  event.preventDefault();
  const query = memoryQuery.value.trim();
  const recipes = getAllRecipes();
  if (!query || recipes.length === 0) return;

  findMemoryConnectionsButton.disabled = true;
  findMemoryConnectionsButton.textContent = "Finding connections…";
  memoryStatus.textContent = "Placing this memory inside the model’s meaning space…";

  const recipeTexts = recipes.map(recipeToEmbeddingText);
  let vectors;
  let usedModel = true;

  try {
    vectors = await requestEmbeddings([
      `query: ${query}`,
      ...recipeTexts.map(text => `passage: ${text}`)
    ]);
  } catch (error) {
    console.warn("Embedding service unavailable; using local similarity", error);
    usedModel = false;
    vectors = [query, ...recipeTexts].map(buildFallbackEmbedding);
  }

  const queryVector = vectors[0];
  state.memoryMatches = recipes.map((recipe, index) => ({
    recipe,
    score: cosineSimilarity(queryVector, vectors[index + 1])
  })).sort((a, b) => b.score - a.score);

  renderMemoryConnections(query, state.memoryMatches);
  memoryResults.classList.remove("hidden");
  memoryStatus.textContent = usedModel
    ? "The map uses a multilingual AI embedding. Recipes with closer meanings sit nearer your memory."
    : "The school embedding service was unavailable, so this preview uses local word relationships instead.";
  findMemoryConnectionsButton.disabled = false;
  findMemoryConnectionsButton.textContent = "Find nearby memories";
  memoryResults.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function requestEmbeddings(texts) {
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      version: EMBEDDING_VERSION,
      input: {
        texts: JSON.stringify(texts),
        batch_size: 32,
        normalize_embeddings: true
      }
    })
  });

  if (!response.ok) throw new Error(`Embedding request failed with ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  const output = data.output ?? data;
  const vectors = Array.isArray(output?.embeddings) ? output.embeddings : output;
  const isValid = Array.isArray(vectors)
    && vectors.length === texts.length
    && vectors.every(vector => Array.isArray(vector) && vector.length > 0 && vector.every(Number.isFinite));
  if (!isValid) throw new Error("The embedding model returned an unexpected result");
  return vectors;
}

function recipeToEmbeddingText(recipe) {
  return [
    recipe.title,
    recipe.story,
    Array.isArray(recipe.ingredients) ? recipe.ingredients.join(", ") : "",
    recipe.instructions,
    `category: ${getRecipeCategory(recipe)}`
  ].filter(Boolean).join(". ").slice(0, 1600);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] ** 2;
    magnitudeB += b[index] ** 2;
  }
  const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return denominator ? dot / denominator : 0;
}

function buildFallbackEmbedding(text) {
  const dimensions = 96;
  const vector = new Array(dimensions).fill(0);
  const normalized = String(text).toLowerCase().normalize("NFKD");
  const semanticGroups = [
    ["grandmother", "grandma", "family", "mother", "father", "外婆", "奶奶", "家人", "妈妈", "爸爸"],
    ["childhood", "memory", "home", "grew up", "小时候", "回忆", "家乡", "家里"],
    ["warm", "comfort", "rain", "winter", "cozy", "温暖", "下雨", "冬天", "安慰"],
    ["summer", "garden", "fresh", "picnic", "夏天", "花园", "清新", "野餐"],
    ["sweet", "sugar", "cake", "dessert", "honey", "甜", "糖", "蛋糕", "甜点"],
    ["savory", "salty", "spicy", "garlic", "咸", "辣", "大蒜", "香"],
    ["celebration", "birthday", "holiday", "festival", "庆祝", "生日", "节日", "春节"],
    ["quick", "simple", "after school", "midnight", "简单", "放学", "夜宵", "快速"],
    ["soup", "stew", "broth", "noodle", "汤", "炖", "面"],
    ["bread", "pancake", "flour", "baked", "面包", "煎饼", "面粉", "烤"],
    ["fruit", "lemon", "apple", "berry", "水果", "柠檬", "苹果", "莓"],
    ["rice", "dumpling", "porridge", "米饭", "饺子", "粥"]
  ];

  semanticGroups.forEach((words, index) => {
    words.forEach(word => {
      if (normalized.includes(word)) vector[index] += 2.4;
    });
  });

  const latinTokens = normalized.match(/[a-z0-9]+/g) || [];
  const chinese = normalized.match(/[\u3400-\u9fff]/g) || [];
  const tokens = [...latinTokens, ...chinese, ...chinese.slice(0, -1).map((character, index) => character + chinese[index + 1])];
  tokens.forEach(token => {
    let hash = 2166136261;
    for (const character of token) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    vector[12 + (Math.abs(hash) % (dimensions - 12))] += 1;
  });

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  return vector.map(value => value / magnitude);
}

function renderMemoryConnections(query, matches) {
  const compactMap = window.matchMedia("(max-width: 540px)").matches;
  const visibleMatches = matches.slice(0, compactMap ? 6 : 8);
  memoryNodes.innerHTML = "";
  memoryLines.innerHTML = "";
  closestMemoryList.innerHTML = "";

  const scores = visibleMatches.map(match => match.score);
  const highest = Math.max(...scores);
  const lowest = Math.min(...scores);
  const spread = Math.max(.0001, highest - lowest);

  visibleMatches.forEach((match, index) => {
    const measuredCloseness = (match.score - lowest) / spread;
    const rankCloseness = visibleMatches.length === 1 ? 1 : 1 - index / (visibleMatches.length - 1);
    const closeness = Math.pow(measuredCloseness * .72 + rankCloseness * .28, 1.55);
    const angle = (-Math.PI / 2) + (index / Math.max(1, visibleMatches.length)) * Math.PI * 2;
    const radius = (compactMap ? 30 : 18) + (1 - closeness) * (compactMap ? 17 : 28);
    const x = clamp(50 + Math.cos(angle) * radius, 11, 89);
    const y = clamp(50 + Math.sin(angle) * radius * (compactMap ? .7 : .82), 12, 88);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const bendX = 500 + (x * 10 - 500) * .48 + ((index % 2 ? 1 : -1) * 24);
    const bendY = 280 + (y * 5.6 - 280) * .48;
    line.setAttribute("d", `M 500 280 Q ${bendX.toFixed(1)} ${bendY.toFixed(1)} ${(x * 10).toFixed(1)} ${(y * 5.6).toFixed(1)}`);
    line.style.setProperty("--connection-strength", String(.18 + closeness * .76));
    line.style.setProperty("--connection-width", String(.9 + closeness * 3.4));
    memoryLines.appendChild(line);

    const node = document.createElement("button");
    node.type = "button";
    node.className = `memory-node${match.recipe.isSimulated ? " is-simulated" : ""}${index === 0 ? " is-strongest" : ""}`;
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    node.style.setProperty("--node-turn", `${((index % 5) - 2) * 1.2}deg`);
    node.style.setProperty("--node-scale", String(.86 + closeness * .18));
    node.innerHTML = `<img alt=""><span></span><small></small>`;
    node.querySelector("img").src = match.recipe.imageUrl;
    node.querySelector("img").alt = `${match.recipe.title} illustration`;
    node.querySelector("span").textContent = match.recipe.title;
    node.querySelector("small").textContent = match.recipe.isSimulated ? "simulated cook" : `by ${match.recipe.author}`;
    node.title = `${Math.round(match.score * 1000) / 10}% cosine similarity · ${connectionLabel(closeness, index)}`;
    node.setAttribute("aria-label", `${match.recipe.title}, ${connectionLabel(closeness, index)} to your memory`);
    node.addEventListener("click", () => {
      memoryDialog.close();
      openRecipe(match.recipe, { fromMemory: true });
    });
    memoryNodes.appendChild(node);
  });

  matches.slice(0, 3).forEach((match, index) => {
    const measuredCloseness = (match.score - lowest) / spread;
    const rankCloseness = visibleMatches.length === 1 ? 1 : 1 - index / (visibleMatches.length - 1);
    const closeness = Math.pow(measuredCloseness * .72 + rankCloseness * .28, 1.55);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "closest-memory-card";
    button.innerHTML = `<span class="closest-number"></span><span class="closest-copy"><strong></strong><small></small></span><span class="closest-score"></span>`;
    button.querySelector(".closest-number").textContent = String(index + 1).padStart(2, "0");
    button.querySelector("strong").textContent = match.recipe.title;
    button.querySelector("small").textContent = match.recipe.isSimulated
      ? `${match.recipe.author} · simulated cook`
      : `${match.recipe.author} · ${shortStory(match.recipe.story)}`;
    button.style.setProperty("--match-strength", `${Math.round((.2 + closeness * .8) * 100)}%`);
    button.title = `${Math.round(match.score * 1000) / 10}% cosine similarity`;
    button.querySelector(".closest-score").textContent = connectionLabel(closeness, index);
    button.addEventListener("click", () => {
      memoryDialog.close();
      openRecipe(match.recipe, { fromMemory: true });
    });
    closestMemoryList.appendChild(button);
  });

  const youLabel = document.querySelector(".memory-you span");
  youLabel.title = query;
}

function connectionLabel(closeness, index) {
  if (index === 0) return "Strongest link";
  if (closeness >= .68) return "Very close";
  if (closeness >= .38) return "Connected";
  return "Faint link";
}

function shortStory(story) {
  const value = String(story || "A recipe waiting for a shared memory").trim();
  return value.length > 64 ? `${value.slice(0, 61)}…` : value;
}

function getAllRecipes() {
  return [...state.recipes, ...state.simulatedRecipes];
}

function createSimulatedRecipes() {
  const examples = [
    ["Mina", "Rainy Day Miso Soup", "My father made this quiet soup whenever the windows fogged up after school.", ["miso", "tofu", "seaweed", "scallions"], "main", "Warm water and dissolve in the miso. Add tofu and seaweed, simmer gently for five minutes, then finish with scallions."],
    ["Theo", "Sunday Lemon Cake", "The bright lemon smell meant cousins were about to arrive for Sunday lunch.", ["lemon", "flour", "eggs", "sugar"], "sweet", "Whisk eggs and sugar, fold in flour, lemon zest and juice, then bake until golden and springy."],
    ["Asha", "Cardamom Milk Tea", "A small cup shared with my mother while the rest of the house was still asleep.", ["black tea", "milk", "cardamom", "ginger"], "drink", "Simmer crushed cardamom and ginger in water, steep the tea, add milk and strain into small cups."],
    ["Jun", "Midnight Tomato Noodles", "The first meal I learned to cook alone in my college apartment.", ["noodles", "tomato", "garlic", "chili"], "main", "Cook the noodles. Sizzle garlic and chili, soften the tomatoes into a sauce, then toss everything together."],
    ["Rosa", "Garden Peach Toast", "We ate ripe peaches over the sink during the hottest week of summer.", ["bread", "peach", "honey", "ricotta"], "snack", "Toast the bread, spread with ricotta, layer over sliced peaches and finish with a little honey."],
    ["Nico", "Snow Day Dumplings", "Everyone crowded around the table folding imperfect dumplings while snow covered the street.", ["flour", "cabbage", "mushroom", "soy sauce"], "main", "Mix chopped cabbage and mushrooms with soy sauce, seal spoonfuls in wrappers, then steam or pan-fry."],
    ["Layla", "Birthday Rice Pudding", "The cinnamon pattern on top changed every birthday, but the recipe never did.", ["rice", "milk", "cinnamon", "sugar"], "sweet", "Slowly simmer rice with milk and sugar until creamy. Chill or serve warm with cinnamon on top."],
    ["Sam", "After-School Corn Cakes", "Crisp edges and salty butter made the walk home feel worth it.", ["corn", "flour", "salt", "butter"], "snack", "Stir corn, flour, salt and water into a thick batter, then fry small cakes in butter until crisp."],
    ["Inez", "Green Market Pasta", "This tastes like carrying an overfilled market bag through warm city streets.", ["pasta", "basil", "peas", "olive oil"], "main", "Boil the pasta and peas, then toss with torn basil, olive oil and a splash of pasta water."],
    ["Bo", "Grandpa’s Scallion Pancakes", "He never measured anything and always gave the crispiest piece to the youngest person.", ["flour", "scallions", "salt", "sesame oil"], "main", "Make a soft dough, roll it with sesame oil and scallions, coil it, flatten it and pan-fry both sides."],
    ["Emi", "First-Summer Strawberry Ice", "We crushed berries and ice after swimming until our hands turned pink.", ["strawberry", "ice", "lemon", "sugar"], "sweet", "Blend strawberries with lemon and sugar, freeze until firm, then scrape into soft crystals."],
    ["Amir", "Friday Lentil Stew", "The pot stayed on the stove for anyone who arrived late from work.", ["lentils", "tomato", "cumin", "onion"], "main", "Brown the onion with cumin, add tomato and lentils, cover with water and simmer until tender."],
    ["Clara", "Library Hot Chocolate", "A thermos of chocolate made winter study sessions feel less lonely.", ["cocoa", "milk", "dark chocolate", "salt"], "drink", "Warm milk with cocoa and a pinch of salt, whisk in dark chocolate and pour into a thermos."],
    ["Noah", "Campfire Apple Toast", "Smoke, apples and too much cinnamon from our first camping trip.", ["apple", "bread", "cinnamon", "butter"], "snack", "Cook apple slices in butter and cinnamon until soft, then spoon them over fire-toasted bread."],
    ["Sora", "New Year Rice Cake Soup", "Each bowl marked another year and another seat added to the family table.", ["rice cakes", "broth", "egg", "scallions"], "main", "Simmer sliced rice cakes in broth until tender, ribbon in beaten egg and garnish with scallions."],
    ["Mae", "Little Red Bean Buns", "My aunt wrapped these in paper for the long train ride back home.", ["flour", "red bean", "sugar", "yeast"], "sweet", "Let the dough rise, wrap it around sweet red bean paste and steam the buns until fluffy."],
    ["Omar", "Rooftop Mint Lemonade", "We drank this under string lights when the apartment was too hot to sleep.", ["lemon", "mint", "water", "sugar"], "drink", "Muddle mint with sugar, add lemon juice and cold water, then serve over plenty of ice."],
    ["Tess", "Autumn Pumpkin Soup", "The color reminds me of leaves stuck to wet boots by the kitchen door.", ["pumpkin", "onion", "broth", "nutmeg"], "main", "Roast the pumpkin, soften the onion, add broth and nutmeg, then blend until velvety."],
    ["Kai", "Train Station Egg Sandwich", "A simple breakfast eaten before every early trip with my sister.", ["egg", "bread", "mayonnaise", "pepper"], "snack", "Mash boiled eggs with mayonnaise and pepper, spread thickly on soft bread and cut in half."],
    ["Priya", "Festival Coconut Sweets", "We rolled them together while music and conversation filled every room.", ["coconut", "condensed milk", "cardamom", "pistachio"], "sweet", "Cook coconut with condensed milk and cardamom, cool slightly, roll into balls and coat with pistachio."],
    ["Luca", "Window-Sill Herb Focaccia", "The first thing baked with herbs grown in our tiny apartment window.", ["flour", "rosemary", "olive oil", "salt"], "main", "Let the dough rise, press it into an oiled pan, dimple with rosemary and bake until deeply golden."],
    ["Mei", "Cold Sesame Noodles", "My grandmother packed these for humid afternoons at the neighborhood pool.", ["noodles", "sesame", "cucumber", "vinegar"], "main", "Rinse cooked noodles cold, toss with sesame paste and vinegar, then top with cucumber."],
    ["Ana", "Kitchen-Dance Mango Lassi", "The blender was so loud that we danced while waiting for it to stop.", ["mango", "yogurt", "milk", "cardamom"], "drink", "Blend ripe mango with yogurt, milk and cardamom until smooth, then serve very cold."],
    ["Finn", "Quiet Morning Oat Porridge", "Steam rising from this bowl is my favorite part of slow winter mornings.", ["oats", "milk", "pear", "honey"], "main", "Simmer oats in milk until creamy, fold in diced pear and finish with honey."],
    ["Yara", "Orange Blossom Semolina Cake", "The floral syrup reminds me of crowded spring lunches at my aunt’s house.", ["semolina", "orange blossom water", "yogurt", "almonds"], "sweet", "Mix semolina with yogurt, bake until golden, then soak the warm cake with orange blossom syrup and almonds."]
  ];

  const dishTypes = ["blue-bowl", "pink-plate", "green-bowl", "check-plate"];
  const names = examples.map(example => example[0]);
  const savedRatings = readSimulatedRatings();
  return examples.map(([author, title, story, ingredients, category, instructions], index) => {
    const id = `simulated-${index + 1}`;
    return {
      id,
      author,
      title,
      story,
      ingredients,
      category,
      instructions,
      dishType: dishTypes[index % dishTypes.length],
      imageUrl: createFallbackFood(title, ingredients),
      imageSource: "simulated",
      createdAt: Date.now() - (index + 1) * 86400000,
      stars: { ...createSimulatedStars(index, names), ...(savedRatings[id] || {}) },
      isSimulated: true
    };
  });
}

function createSimulatedStars(seed, names) {
  const count = 1 + (seed * 3) % 7;
  const stars = {};
  for (let index = 0; index < count; index += 1) {
    const palette = STAR_PALETTES[(seed + index) % STAR_PALETTES.length];
    const simulatedName = names[(seed + index + 4) % names.length];
    stars[`simulated-reader-${seed}-${index}`] = {
      ...palette,
      author: `${simulatedName} · simulated cook`,
      x: 14 + ((seed * 17 + index * 23) % 72),
      y: 10 + ((seed * 11 + index * 19) % 68),
      rotation: ((seed + index) % 7) * 5 - 15,
      updatedAt: Date.now(),
      isSimulated: true
    };
  }
  return stars;
}

function readSimulatedRatings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SIMULATED_RATINGS_STORAGE_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function saveSimulatedRating(recipeId, personId, star) {
  const ratings = readSimulatedRatings();
  ratings[recipeId] = { ...(ratings[recipeId] || {}), [personId]: star };
  localStorage.setItem(SIMULATED_RATINGS_STORAGE_KEY, JSON.stringify(ratings));
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
