/**
 * script.js
 * Purpose: Client-side logic for the EMC Trading Inventory Management UI.
 *
 * Responsibilities:
 *  - Hold and manage the in-memory inventory dataset (inventoryData).
 *  - Provide filtering, sorting and rendering of the inventory table.
 *  - Handle dialog interactions (Add Item, Stock In, Stock Out).
 *  - Provide lightweight notifications (showToast).
 *  - Enforce business rules such as global reorder-level cap.
 *
 * Usage:
 *  - This file is included by index..html and runs after DOM is available.
 *  - Call setReorderLevel(id, level) from console for quick edits.
 *  - New items are added through the Add Item dialog and validated by handleAddItem().
 *
 * Notes:
 *  - This app stores data in memory only; refresh will reset inventoryData to initial state.
 *  - For production persistence, integrate server-side API calls where items are created/updated.
 */

/* --- Initial Data and State ----------------------------------------------
   inventoryData: in-memory array of inventory item objects used as the single
                  source of truth for the UI during the page lifecycle.
   state: UI state such as search, active category filter and sorting info.
------------------------------------------------------------------------- */
let inventoryData = [
    { id: 'T003', name: 'Steel Hammer', category: 'Tools', quantity: 100, lastUpdated: '2025-11-10', reorderLevel: 20, supplier: 'ACME Tools', unit: 'pcs', imageName: null, imageUrl: null },
    { id: 'H001', name: 'Hammer - Professional', category: 'Tools', quantity: 45, lastUpdated: '2025-10-13', reorderLevel: 20, supplier: 'HammerCo', unit: 'pcs', imageName: null, imageUrl: null },
    { id: 'P002', name: 'Premium Paint - Blue', category: 'Paint', quantity: 8, lastUpdated: '2025-10-12', reorderLevel: 20, supplier: 'ColorWorks', unit: 'liter', imageName: null, imageUrl: null },
    { id: 'E001', name: 'Electrical Wire 2.0mm', category: 'Electrical', quantity: 200, lastUpdated: '2025-10-12', reorderLevel: 20, supplier: 'WireMakers', unit: 'meter', imageName: null, imageUrl: null },
    { id: 'T001', name: 'Cement - Portland', category: 'Construction', quantity: 320, lastUpdated: '2025-10-11', reorderLevel: 20, supplier: 'BuildSupplies', unit: 'kg', imageName: null, imageUrl: null },
    { id: 'E002', name: 'Light Bulbs LED', category: 'Electrical', quantity: 5, lastUpdated: '2025-10-11', reorderLevel: 20, supplier: 'BrightLights', unit: 'box', imageName: null, imageUrl: null },
    { id: 'P001', name: 'Premium Paint - White', category: 'Paint', quantity: 150, lastUpdated: '2025-10-10', reorderLevel: 20, supplier: 'ColorWorks', unit: 'liter', imageName: null, imageUrl: null },
    { id: 'H002', name: 'Screwdriver Set', category: 'Tools', quantity: 12, lastUpdated: '2025-10-10', reorderLevel: 20, supplier: 'ACME Tools', unit: 'box', imageName: null, imageUrl: null },
    { id: 'C001', name: 'Steel Rods 10mm', category: 'Construction', quantity: 0, lastUpdated: '2025-10-09', reorderLevel: 20, supplier: 'MetalWorks', unit: 'pcs', imageName: null, imageUrl: null },
];

let state = {
    searchQuery: '',
    categoryFilter: 'all',
    sortBy: 'lastUpdated',
    sortOrder: 'desc', // 'desc' for Z-A
    selectedItem: null,
    stockAmount: '',
    userRole: 'Admin' 
};

// New: default / maximum reorder level enforced across all items
const DEFAULT_REORDER_LEVEL = 20;

/* --- DOM Elements (cached) ----------------------------------------------
  Cache frequently used DOM elements here to avoid repeated lookups during
  rendering and event handling. The element ids must match the markup in
  index..html.
--------------------------------------------------------------------------*/
const tableBody = document.getElementById('inventory-table-body');
const searchInput = document.getElementById('search-input');
const categoryFilterSelect = document.getElementById('category-filter');
const inventoryInfo = document.getElementById('inventory-info');
const sortButtons = document.querySelectorAll('.sort-button');
const toastContainer = document.getElementById('toast-container');

// Dialog / Add-Item Form Elements (updated to match index..html IDs)
const addItemDialog = document.getElementById('add-item-dialog');
const addItemForm = document.getElementById('add-item-form');
const itemNameInput = document.getElementById('item-name');
const categoryNameInput = document.getElementById('category-name');
const initialQuantityInput = document.getElementById('initial-quantity');
const supplierNameInput = document.getElementById('supplier-name');
const itemImageInput = document.getElementById('item-image');
const dateAddedInput = document.getElementById('date-added');
const unitSelect = document.getElementById('unit');
const reorderLevelInput = document.getElementById('reorder-level');

const confirmAddItemButton = document.getElementById('confirm-add-item');
const cancelAddItemButton = document.getElementById('cancel-add-item');

const stockInDialog = document.getElementById('stock-in-dialog');
const stockOutDialog = document.getElementById('stock-out-dialog');

const addItemButtonMobile = document.getElementById('add-item-button');
const addItemButtonDesktop = document.getElementById('add-item-button-desktop');


// --- Toast Notification System ------------------------------------------
/*
  showToast(type, title, description)
  - Simple in-page notification helper used across the app to surface
    success/warning/error messages to the user.
  - type: 'success' | 'warning' | 'error' (determines color).
  - title: main line text (required).
  - description: optional smaller text under the title.
*/
function showToast(type, title, description = '') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        ${description ? `<div class="toast-description">${description}</div>` : ''}
    `;
    toastContainer.appendChild(toast);

    // Show the toast
    setTimeout(() => toast.classList.add('show'), 10);

    // Hide and remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
}


// --- Helper Functions ---------------------------------------------------
/*
  getStockStatus(quantity)
  - Determines a small, human-friendly stock status label and styling class
    based on a numeric quantity.
  - This is used when rendering the status pill in the table.
*/
function getStockStatus(quantity) {
    let status;
    let className;

    if (quantity === 0) {
        status = 'Out of Stock';
        className = 'bg-red-100 text-red-700';
    } else if (quantity < 20) {
        status = 'Low Stock';
        className = 'bg-orange-100 text-orange-700';
    } else {
        status = 'In Stock';
        className = 'bg-green-100 text-green-700';
    }
    return { status, className };
}

/*
  renderSortIcon(column)
  - Returns a simple textual ↑↓ indicator with classes that reflect the active
    sort column and direction. Kept simple for accessibility and smaller bundle.
*/
function renderSortIcon(column) {
    // Highlight arrow corresponding to current order only if this is the active column
    const isActive = state.sortBy === column;
    const upClass = isActive && state.sortOrder === 'asc' ? 'text-blue-600 font-semibold' : 'text-slate-400';
    const downClass = isActive && state.sortOrder === 'desc' ? 'text-blue-600 font-semibold' : 'text-slate-400';

    // Always return the arrows so they are visible without clicking
    return `<span class="sort-arrows ml-1" aria-hidden="true"><span class="${upClass}">↑</span><span class="${downClass} ml-0.5">↓</span></span>`;
}

/*
  renderActions(item)
  - Returns the HTML for action buttons (Stock In/Out/Archive) for a given row.
  - Buttons use data-id attributes so event delegations can map them back to
    inventory items.
*/
function renderActions(item) {
    const archiveButton = state.userRole === 'Admin' ? `
        <button data-id="${item.id}" class="archive-btn w-8 h-8 flex items-center justify-center text-sm font-medium rounded-lg text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors" title="Archive: Remove item from list">
            <i data-lucide="archive" class="w-4 h-4"></i>
        </button>` : '';

    return `
        <div class="flex gap-2">
            <button data-id="${item.id}" class="stock-in-btn w-8 h-8 flex items-center justify-center text-sm font-medium rounded-lg border border-green-500 text-green-700 hover:bg-green-50 transition-colors" title="Stock In: Add new stock">
                <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
            <button data-id="${item.id}" class="stock-out-btn w-8 h-8 flex items-center justify-center text-sm font-medium rounded-lg border border-red-500 text-red-700 hover:bg-red-50 transition-colors" title="Stock Out: Deduct stock">
                <i data-lucide="minus" class="w-4 h-4"></i>
            </button>
            ${archiveButton}
        </div>
    `;
}

/*
  renderTable()
  - Main renderer that:
    1. Filters inventoryData by search + category.
    2. Sorts by the configured column/order.
    3. Generates table rows (HTML) and injects into the DOM.
    4. Re-initializes icons and attaches dynamic listeners for action buttons.
  - Keep rendering lightweight; if the dataset grows, consider virtualized
    rendering or paging.
*/
function renderTable() {
    // 1. Filtering
    const filtered = inventoryData.filter(item => {
        const q = state.searchQuery.toLowerCase();
        const matchesSearch = item.id.toLowerCase().includes(q) ||
                              item.name.toLowerCase().includes(q);
        const matchesCategory = state.categoryFilter === 'all' || item.category === state.categoryFilter;
        return matchesSearch && matchesCategory;
    });

    // 2. Sorting
    const sorted = filtered.sort((a, b) => {
        let valA = a[state.sortBy];
        let valB = b[state.sortBy];

        // Handle date sorting
        if (state.sortBy === 'lastUpdated') {
            valA = new Date(valA).getTime();
            valB = new Date(valB).getTime();
        } 
        // Handle string comparison for 'name' and 'category'
        else if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (valA < valB) return state.sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return state.sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    // 3. Rendering rows
    tableBody.innerHTML = sorted.map(item => {
        const { status, className } = getStockStatus(item.quantity);

        // Effective reorder level
        const reorder = (typeof item.reorderLevel === 'number') ? item.reorderLevel : DEFAULT_REORDER_LEVEL;
        const needsReorder = item.quantity <= reorder;

        // Supplier / unit fallback
        const supplierText = item.supplier || '-';
        const unitText = item.unit || (item.unit === 0 ? '0' : '-');

        // Image rendering: prefer imageUrl, fallback to imageName text
        const imageCell = item.imageUrl ?
            `<img src="${item.imageUrl}" alt="${(item.imageName || item.name).replace(/"/g, '&quot;')}" class="object-cover rounded-md border" />` :
            `<div class="text-xs text-slate-500">${item.imageName ? item.imageName : 'no image'}</div>`;

        return `
            <tr class="hover:bg-gray-50 transition-colors duration-150">
                <td class="px-4 py-3 whitespace-nowrap font-mono text-sm text-gray-900">${item.id}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${item.name}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${supplierText}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${item.category}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${unitText}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${item.quantity}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${reorder}</td>
                <td class="px-4 py-3 text-sm text-gray-700">
                    <div class="status-cell">
                        <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${className}">
                            ${status}
                        </span>
                        ${needsReorder ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Reorder (≤${reorder})</span>` : ''}
                    </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-600">${item.lastUpdated}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">${imageCell}</td>
                <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    ${renderActions(item)}
                </td>
            </tr>
        `;
    }).join('');

    // Update info text
    const sortLabelMap = {
        'id': 'ID',
        'name': 'Item Name',
        'quantity': 'Quantity',
        'lastUpdated': 'Last Updated'
    };
    const currentSortLabel = sortLabelMap[state.sortBy] || state.sortBy;
    const orderLabel = state.sortOrder === 'asc' ? 'A-Z' : 'Z-A';
    inventoryInfo.innerHTML = `${sorted.length} items found <span class="text-slate-500 ml-2">• Sorted by ${currentSortLabel} (${orderLabel})</span>`;

    // Re-initialize Lucide icons for new content and attach listeners
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
    attachActionListeners();
    updateSortIcons();
}

/**
 * Updates the sort icons (↑↓) in the table header.
 */
function updateSortIcons() {
    sortButtons.forEach(button => {
        const column = button.dataset.sort;
        // Remove any previous arrow-up-down lucide icon or textual arrows
        button.querySelector('i[data-lucide="arrow-up-down"]')?.remove();
        button.querySelector('.sort-arrows')?.remove();

        // Always insert the text arrows so they are visible on load
        button.insertAdjacentHTML('beforeend', renderSortIcon(column));
    });
    // Re-initialize Lucide icons for the header (other icons)
    if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

/**
 * Populates the category filter dropdown.
 */
function populateCategoryFilter() {
    const categories = [...new Set(inventoryData.map(item => item.category))];
    categoryFilterSelect.innerHTML = '<option value="all">All Categories</option>' + 
        categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    // Ensure the current filter is selected if it still exists
    categoryFilterSelect.value = state.categoryFilter;
}

/**
 * General function to open any dialog.
 * @param {HTMLElement} dialogElement - The dialog DOM element.
 */
function openDialog(dialogElement) {
    dialogElement.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

/**
 * General function to close any dialog.
 * @param {HTMLElement} dialogElement - The dialog DOM element.
 */
function closeDialog(dialogElement) {
    dialogElement.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

// --- Event Handlers ---

/**
 * Handles search input changes.
 */
function handleSearch(event) {
    state.searchQuery = event.target.value;
    renderTable();
}

/**
 * Handles category filter changes.
 */
function handleCategoryFilter(event) {
    state.categoryFilter = event.target.value;
    renderTable();
}

/**
 * Handles sorting when a column header is clicked.
 */
function handleSort(event) {
    const column = event.currentTarget.dataset.sort;

    if (state.sortBy === column) {
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortBy = column;
        state.sortOrder = 'asc'; // Default to ascending when switching column
    }
    renderTable();
}

/**
 * Shows the "Add New Item" dialog.
 */
function showAddItemDialog() {
    // Reset the form instead of referencing old variable names
    if (addItemForm) addItemForm.reset();
    // set default date to today if date input exists
    if (dateAddedInput) dateAddedInput.value = new Date().toISOString().split('T')[0];
    openDialog(addItemDialog);
}

/**
 * Handles adding a new item from the dialog.
 * (Updated to store imageUrl so thumbnail shows immediately)
 */
function handleAddItem() {
  const name = document.getElementById("item-name").value.trim();
  const category = document.getElementById("category-name").value.trim();
  const quantity = parseInt(document.getElementById("initial-quantity").value);
  const supplier = document.getElementById("supplier-name").value.trim();
  const image = document.getElementById("item-image").files[0];
  const dateAdded = document.getElementById("date-added").value;
  const unit = document.getElementById("unit").value.trim();
  const reorderLevelInputVal = parseInt(document.getElementById("reorder-level").value);

  // Simple validation
  if (!name || !category || isNaN(quantity) || !supplier || !dateAdded || !unit) {
    showToast("error", "Incomplete Data", "Please fill out all required fields.");
    return;
  }

  // imageName and imageUrl
  const imageName = image ? image.name : null;
  const imageUrl = image ? URL.createObjectURL(image) : null;

  // Clamp provided reorder level to DEFAULT_REORDER_LEVEL
  const reorderLevelValue = (isNaN(reorderLevelInputVal) || reorderLevelInputVal < 0) ? DEFAULT_REORDER_LEVEL : Math.min(reorderLevelInputVal, DEFAULT_REORDER_LEVEL);

  const newItem = {
    id: `${category.charAt(0).toUpperCase()}${Date.now().toString().slice(-4)}`,
    name,
    category,
    quantity,
    supplier,
    unit,
    reorderLevel: reorderLevelValue,
    imageName,
    imageUrl,
    dateAdded,
    lastUpdated: new Date().toISOString().split("T")[0],
  };

  inventoryData.push(newItem);

  // Enforce cap across all items so rule applies globally
  enforceReorderCap();

  populateCategoryFilter(); // keep filters up-to-date
  renderTable();
  showToast("success", `${name} added successfully!`, `Category: ${category}`);

  if (addItemForm) addItemForm.reset();
  closeDialog(addItemDialog);
}

/**
 * General handler for showing a stock dialog.
 * @param {string} dialogId - 'stock-in-dialog' or 'stock-out-dialog'.
 * @param {string} itemId - The ID of the item.
 */
function showStockDialog(dialogId, itemId) {
    const item = inventoryData.find(i => i.id === itemId);
    if (!item) return;

    state.selectedItem = item;
    state.stockAmount = ''; // Reset input

    const dialog = document.getElementById(dialogId);
    const titleElement = dialog.querySelector('h3'); 
    const descriptionElement = dialog.querySelector(`#${dialogId.replace('-dialog', '')}-item-name`);
    const stockElement = dialog.querySelector(`#${dialogId.replace('-dialog', '')}-current-stock`);
    const amountInput = dialog.querySelector(`#${dialogId.replace('-dialog', '')}-amount`);

    if (dialogId === 'stock-in-dialog') {
         titleElement.textContent = 'Stock In';
    } else {
         titleElement.textContent = 'Stock Out';
    }
    descriptionElement.textContent = `${titleElement.textContent} for: ${item.name}`;
    stockElement.textContent = `Current Stock: ${item.quantity} units`;
    amountInput.value = '';
    
    openDialog(dialog);
}


/**
 * Handles the confirmation of Stock In or Stock Out.
 * @param {string} type - 'in' or 'out'.
 */
function handleStockUpdate(type) {
    if (!state.selectedItem) return;

    const dialogId = type === 'in' ? 'stock-in-dialog' : 'stock-out-dialog';
    const amountInput = document.getElementById(`${dialogId.replace('-dialog', '')}-amount`);
    const amount = parseInt(amountInput.value);

    if (isNaN(amount) || amount <= 0) {
        showToast('error', 'Invalid Quantity', 'Please enter a valid amount.');
        return;
    }

    let updatedInventory = inventoryData.map(item => {
        if (item.id === state.selectedItem.id) {
            const change = type === 'in' ? amount : -amount;
            const newQuantity = item.quantity + change;

            if (type === 'out' && newQuantity < 0) {
                showToast('error', 'Insufficient Stock', `Cannot remove ${amount} units. Only ${item.quantity} available.`);
                return item; // Return original item to prevent update
            }
            
            return {
                ...item,
                quantity: newQuantity,
                lastUpdated: new Date().toISOString().split("T")[0]
            };
        }
        return item;
    });

    // Check if the update actually happened (e.g., if stock-out was prevented)
    const itemAfterUpdate = updatedInventory.find(i => i.id === state.selectedItem.id);
    if (itemAfterUpdate.quantity === state.selectedItem.quantity && type === 'out' && amount > state.selectedItem.quantity) {
        // This means the stock-out was prevented due to insufficient stock, no data change needed
        return;
    }

    inventoryData = updatedInventory;
    closeDialog(document.getElementById(dialogId));
    renderTable();

    // Show appropriate toast notification
    if (type === 'in') {
        showToast('success', `Added ${amount} units to ${state.selectedItem.name}`, `New stock level: ${itemAfterUpdate.quantity} units`);
    } else { // type === 'out'
        if (itemAfterUpdate.quantity === 0) {
            showToast('error', `${state.selectedItem.name} is now OUT OF STOCK!`, `Removed ${amount} units - Immediate restocking required.`);
        } else if (itemAfterUpdate.quantity < 20) {
            showToast('warning', `${state.selectedItem.name} is now LOW ON STOCK!`, `Removed ${amount} units - Only ${itemAfterUpdate.quantity} units remaining.`);
        } else {
            showToast('success', `Removed ${amount} units from ${state.selectedItem.name}`, `Remaining stock: ${itemAfterUpdate.quantity} units.`);
        }
    }

    state.selectedItem = null;
}

/**
 * Handles archiving an item.
 * @param {string} itemId - The ID of the item to archive.
 */
function handleArchive(itemId) {
    if (!confirm('Are you sure you want to archive this item?')) return;
    const archivedItem = inventoryData.find(item => item.id === itemId);
    if (archivedItem) {
        inventoryData = inventoryData.filter(item => item.id !== itemId);
        // In a real app, you would move it to an 'archivedInventory' array
        renderTable();
        showToast('success', `${archivedItem.name} archived successfully!`, 'Item moved to archive. View in Archive page.');
    }
}


/**
 * Attaches event listeners for dynamically rendered buttons.
 */
function attachActionListeners() {
    // Stock In Buttons
    document.querySelectorAll('.stock-in-btn').forEach(button => {
        button.onclick = (e) => showStockDialog('stock-in-dialog', e.currentTarget.dataset.id);
    });

    // Stock Out Buttons
    document.querySelectorAll('.stock-out-btn').forEach(button => {
        button.onclick = (e) => showStockDialog('stock-out-dialog', e.currentTarget.dataset.id);
    });

    // Archive Buttons
    document.querySelectorAll('.archive-btn').forEach(button => {
        button.onclick = (e) => handleArchive(e.currentTarget.dataset.id);
    });
}

/**
 * Enforce that every inventory item has a reorderLevel and it does not exceed DEFAULT_REORDER_LEVEL.
 */
function enforceReorderCap() {
    inventoryData.forEach(item => {
        let lvl = parseInt(item.reorderLevel);
        if (isNaN(lvl) || lvl < 0) lvl = DEFAULT_REORDER_LEVEL;
        item.reorderLevel = Math.min(lvl, DEFAULT_REORDER_LEVEL);
    });
}

/**
 * Helper: update an item's reorder level programmatically and re-render.
 * Usage: setReorderLevel('P002', 10);
 */
function setReorderLevel(itemId, level) {
    const lvlParsed = parseInt(level);
    if (isNaN(lvlParsed) || lvlParsed < 0) {
        console.warn('Invalid reorder level', level);
        return;
    }
    const capped = Math.min(lvlParsed, DEFAULT_REORDER_LEVEL);
    const item = inventoryData.find(i => i.id === itemId);
    if (!item) {
        console.warn('Item not found:', itemId);
        return;
    }
    item.reorderLevel = capped;
    renderTable();
}

// --- Initialization ---

/**
 * Initializes the application, running once when the DOM is ready.
 */
function init() {
    // Ensure reorder levels are enforced before first render
    enforceReorderCap();

    // Initial Render
    populateCategoryFilter();
    renderTable(); 

    // Attach static listeners (use safeOn to avoid null-reference errors)
    safeOn(searchInput, 'input', handleSearch);
    safeOn(categoryFilterSelect, 'change', handleCategoryFilter);
    // Attach sort handler to ALL sort buttons (only if any exist)
    if (sortButtons && sortButtons.length) {
        sortButtons.forEach(button => safeOn(button, 'click', handleSort));
    }

    // Add Item Dialog buttons
    safeOn(addItemButtonMobile, 'click', showAddItemDialog);
    safeOn(addItemButtonDesktop, 'click', showAddItemDialog);

    // confirm button (click) and form submit (prevent default)
    safeOn(confirmAddItemButton, 'click', handleAddItem);
    if (addItemForm) {
        safeOn(addItemForm, 'submit', (e) => {
            e.preventDefault();
            handleAddItem();
        });
    }

    safeOn(cancelAddItemButton, 'click', () => {
        if (addItemForm) addItemForm.reset();
        closeDialog(addItemDialog);
    });

    // Stock Dialog Close/Cancel listeners
    safeOn(document.getElementById('cancel-stock-in'), 'click', () => closeDialog(stockInDialog));
    safeOn(document.getElementById('cancel-stock-out'), 'click', () => closeDialog(stockOutDialog));

    // Stock Dialog Confirm listeners
    safeOn(document.getElementById('confirm-stock-in'), 'click', () => handleStockUpdate('in'));
    safeOn(document.getElementById('confirm-stock-out'), 'click', () => handleStockUpdate('out'));
}

// Ensure the DOM is fully loaded before running init()
document.addEventListener('DOMContentLoaded', init);
