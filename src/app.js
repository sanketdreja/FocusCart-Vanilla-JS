import { PRODUCTS } from "./data.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  search: $("#search"),
  category: $("#category"),
  sort: $("#sort"),
  productsGrid: $("#productsGrid"),
  cartItems: $("#cartItems"),
  cartTotal: $("#cartTotal"),
  cartCount: $("#cartCount"),
  cartPanel: $("#cartPanel"),
  cartToggle: $("#cartToggle"),
  cartClose: $("#cartClose"),
  clearCart: $("#clearCart"),
  checkout: $("#checkout"),
};

const STORAGE_KEY = "focuscart:v1";

let state = {
  products: PRODUCTS,
  query: "",
  category: "all",
  sort: "relevance",
  cart: loadCart(), // { [productId]: qty }
};

function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart));
}
function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function formatINR(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

function getFilteredProducts() {
  let list = [...state.products];

  const q = state.query.trim().toLowerCase();
  if (q) {
    list = list.filter((p) => p.title.toLowerCase().includes(q));
  }

  if (state.category !== "all") {
    list = list.filter((p) => p.category === state.category);
  }

  switch (state.sort) {
    case "price-asc":
      list.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      list.sort((a, b) => b.price - a.price);
      break;
    case "rating-desc":
      list.sort((a, b) => b.rating - a.rating);
      break;
    default:
      // relevance: keep as-is
      break;
  }

  return list;
}

function renderCategories() {
  const cats = Array.from(new Set(state.products.map((p) => p.category)));
  const options = ['<option value="all">All categories</option>']
    .concat(cats.map((c) => `<option value="${c}">${capitalize(c)}</option>`))
    .join("");
  els.category.innerHTML = options;
  els.category.value = state.category;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderProducts() {
  const list = getFilteredProducts();

  if (list.length === 0) {
    els.productsGrid.innerHTML = `<div class="card"><div class="card__body">
      <h3 class="card__title">No products found</h3>
      <p class="meta">Try a different search/filter.</p>
    </div></div>`;
    return;
  }

  els.productsGrid.innerHTML = list
    .map((p) => {
      const inCartQty = state.cart[p.id] || 0;
      return `
      <article class="card">
        <div class="card__img" role="img" aria-label="${escapeHtml(p.title)}"></div>
        <div class="card__body">
          <h3 class="card__title">${escapeHtml(p.title)}</h3>
          <div class="meta">
            <span class="pill">${capitalize(p.category)}</span>
            <span>⭐ ${p.rating.toFixed(1)}</span>
          </div>
          <div class="card__actions">
            <span class="price">${formatINR(p.price)}</span>
            <button class="btn btn--primary" data-add="${p.id}" type="button">
              Add ${inCartQty ? `(${inCartQty})` : ""}
            </button>
          </div>
        </div>
      </article>
      `;
    })
    .join("");
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (ch) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[ch] || ch;
  });
}

/** CART */
function getCartLines() {
  const lines = Object.entries(state.cart)
    .map(([id, qty]) => {
      const product = state.products.find((p) => p.id === id);
      if (!product) return null;
      return { product, qty };
    })
    .filter(Boolean);
  return lines;
}

function cartTotals() {
  const lines = getCartLines();
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const total = lines.reduce((sum, l) => sum + l.qty * l.product.price, 0);
  return { count, total };
}

function renderCart() {
  const lines = getCartLines();
  const { count, total } = cartTotals();

  els.cartCount.textContent = String(count);
  els.cartTotal.textContent = formatINR(total);

  if (lines.length === 0) {
    els.cartItems.innerHTML = `
      <div class="cartItem">
        <p class="hint">Your cart is empty. Add something ✅</p>
      </div>
    `;
    return;
  }

  els.cartItems.innerHTML = lines
    .map(({ product, qty }) => {
      return `
      <div class="cartItem" data-id="${product.id}">
        <div class="cartItem__top">
          <p class="cartItem__name">${escapeHtml(product.title)}</p>
          <span class="cartItem__price">${formatINR(product.price)}</span>
        </div>

        <div class="qty" aria-label="Quantity controls">
          <button class="btn" data-dec="${product.id}" type="button" aria-label="Decrease quantity">−</button>
          <input class="qtyInput" data-qty="${product.id}" inputmode="numeric" value="${qty}" aria-label="Quantity" />
          <button class="btn" data-inc="${product.id}" type="button" aria-label="Increase quantity">+</button>

          <button class="btn" data-remove="${product.id}" type="button" style="margin-left:auto;border-color:rgba(251,113,133,0.35)">
            Remove
          </button>
        </div>
      </div>
      `;
    })
    .join("");
}

function addToCart(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  saveCart();
  renderProducts();
  renderCart();
}
function removeFromCart(id) {
  delete state.cart[id];
  saveCart();
  renderProducts();
  renderCart();
}
function setQty(id, qty) {
  const safeQty = Math.max(0, Math.min(99, Number.isFinite(qty) ? qty : 0));
  if (safeQty === 0) delete state.cart[id];
  else state.cart[id] = safeQty;

  saveCart();
  renderProducts();
  renderCart();
}

/** EVENTS */
els.productsGrid.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-add]");
  if (!btn) return;
  addToCart(btn.dataset.add);
});

els.cartItems.addEventListener("click", (e) => {
  const inc = e.target.closest("button[data-inc]");
  const dec = e.target.closest("button[data-dec]");
  const rem = e.target.closest("button[data-remove]");

  if (inc) return setQty(inc.dataset.inc, (state.cart[inc.dataset.inc] || 0) + 1);
  if (dec) return setQty(dec.dataset.dec, (state.cart[dec.dataset.dec] || 0) - 1);
  if (rem) return removeFromCart(rem.dataset.remove);
});

els.cartItems.addEventListener("change", (e) => {
  const input = e.target.closest("input[data-qty]");
  if (!input) return;
  const id = input.dataset.qty;
  const parsed = parseInt(input.value, 10);
  setQty(id, Number.isNaN(parsed) ? 1 : parsed);
});

els.search.addEventListener("input", () => {
  state.query = els.search.value;
  renderProducts();
});

els.category.addEventListener("change", () => {
  state.category = els.category.value;
  renderProducts();
});

els.sort.addEventListener("change", () => {
  state.sort = els.sort.value;
  renderProducts();
});

els.clearCart.addEventListener("click", () => {
  state.cart = {};
  saveCart();
  renderProducts();
  renderCart();
});

function openCart(open) {
  // For mobile you could transform this into a drawer; simple approach here:
  els.cartPanel.style.display = open ? "block" : "";
  els.cartToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

els.cartToggle.addEventListener("click", () => openCart(true));
els.cartClose.addEventListener("click", () => openCart(false));

els.checkout.addEventListener("click", () => {
  const { total, count } = cartTotals();
  if (!count) return alert("Cart is empty!");
  alert(`Checkout placeholder ✅\nItems: ${count}\nTotal: ${formatINR(total)}`);
});

/** INIT */
renderCategories();
renderProducts();
renderCart();
