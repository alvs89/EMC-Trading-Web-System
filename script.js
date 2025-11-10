// --- Initial Data and State ---

let inventoryData = [
    { id: 'T003', name: 'Steel Hammer', category: 'Tools', quantity: 100, lastUpdated: '2025-11-10' },
    { id: 'H001', name: 'Hammer - Professional', category: 'Tools', quantity: 45, lastUpdated: '2025-10-13' },
    { id: 'P002', name: 'Premium Paint - Blue', category: 'Paint', quantity: 8, lastUpdated: '2025-10-12' },
    { id: 'E001', name: 'Electrical Wire 2.0mm', category: 'Electrical', quantity: 200, lastUpdated: '2025-10-12' },
    { id: 'T001', name: 'Cement - Portland', category: 'Construction', quantity: 320, lastUpdated: '2025-10-11' },
    { id: 'E002', name: 'Light Bulbs LED', category: 'Electrical', quantity: 5, lastUpdated: '2025-10-11' },
    { id: 'P001', name: 'Premium Paint - White', category: 'Paint', quantity: 150, lastUpdated: '2025-10-10' },
    { id: 'H002', name: 'Screwdriver Set', category: 'Tools', quantity: 12, lastUpdated: '2025-10-10' },
    { id: 'C001', name: 'Steel Rods 10mm', category: 'Construction', quantity: 0, lastUpdated: '2025-10-09' },
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

// --- DOM Elements ---
const tableBody = document.getElementById('inventory-table-body');
const searchInput = document.getElementById('search-input');
const categoryFilterSelect = document.getElementById('category-filter');
const inventoryInfo = document.getElementById('inventory-info');
const sortButtons = document.querySelectorAll('.sort-button');
const toastContainer = document.getElementById('toast-container');

// Dialog Elements
const addItemDialog = document.getElementById('add-item-dialog');
const newItemNameInput = document.getElementById('new-item-name');
const newItemCategoryInput = document.getElementById('new-item-category');
const newItemQuantityInput = document.getElementById('new-item-quantity');
const confirmAddItemButton = document.getElementById('confirm-add-item');
const cancelAddItemButton = document.getElementById('cancel-add-item');

const stockInDialog = document.getElementById('stock-in-dialog');
const stockOutDialog = document.getElementById('stock-out-dialog');

const addItemButtonMobile = document.getElementById('add-item-button');
const addItemButtonDesktop = document.getElementById('add-item-button-desktop');


// --- Toast Notification System ---
/**
 * Displays a toast notification.
 * @param {'success' | 'warning' | 'error'} type - The type of toast.
 * @param {string} title - The main message.
 * @param {string} [description] - Optional detailed description.
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


// --- Helper Functions ---

/**
 * Calculates the stock status based on quantity.
 * @param {number} quantity - The current quantity.
 * @returns {{status: string, className: string}} The status and Tailwind class name.
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

/**
 * Renders the combined sort icon (↑↓) as text and highlights the active direction.
 * @param {string} column - The column being sorted.
 * @returns {string} HTML for the sort icon.
 */
function renderSortIcon(column) {
    // Highlight arrow corresponding to current order only if this is the active column
    const isActive = state.sortBy === column;
    const upClass = isActive && state.sortOrder === 'asc' ? 'text-blue-600 font-semibold' : 'text-slate-400';
    const downClass = isActive && state.sortOrder === 'desc' ? 'text-blue-600 font-semibold' : 'text-slate-400';

    // Always return the arrows so they are visible without clicking
    return `<span class="sort-arrows ml-1" aria-hidden="true"><span class="${upClass}">↑</span><span class="${downClass} ml-0.5">↓</span></span>`;
}

/**
 * Generates the HTML for the actions cell.
 * @param {object} item - The inventory item.
 * @returns {string} HTML string.
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

/**
 * Populates the table with filtered and sorted data.
 */
function renderTable() {
    // 1. Filtering
    const filtered = inventoryData.filter(item => {
        const matchesSearch = item.id.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                              item.name.toLowerCase().includes(state.searchQuery.toLowerCase());
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

    // 3. Rendering
    tableBody.innerHTML = sorted.map(item => {
        const { status, className } = getStockStatus(item.quantity);
        return `
            <tr class="hover:bg-gray-50 transition-colors duration-150">
                <td class="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">${item.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.category}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.quantity}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${className}">
                        ${status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">${item.lastUpdated}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
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
    // This is the function that handles injecting the single '↑↓' icon
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
    newItemNameInput.value = '';
    newItemCategoryInput.value = '';
    newItemQuantityInput.value = '';
    openDialog(addItemDialog);
}

/**
 * Handles adding a new item from the dialog.
 */
function handleAddItem() {
    const name = newItemNameInput.value.trim();
    const category = newItemCategoryInput.value.trim();
    const quantity = parseInt(newItemQuantityInput.value.trim());

    if (!name || !category || isNaN(quantity) || quantity < 0) {
        showToast('error', 'Validation Error', 'Please fill in all fields with valid data.');
        return;
    }

    // Check for duplicate item (case-insensitive name and category)
    const existingItem = inventoryData.find(item =>
        item.name.toLowerCase() === name.toLowerCase() &&
        item.category.toLowerCase() === category.toLowerCase()
    );

    if (existingItem) {
        showToast(
            'error',
            'Item Already Exists!',
            `"${name}" in category "${category}" is already in inventory (ID: ${existingItem.id}). Use Stock In to add more units.`
        );
        return;
    }

    // Generate ID (P001, T001, E001 etc.)
    const prefix = category.charAt(0).toUpperCase();
    const sameCategoryItems = inventoryData.filter(item => item.id.startsWith(prefix));
    const nextNumber = (sameCategoryItems.length + 1).toString().padStart(3, '0');
    const newId = `${prefix}${nextNumber}`;

    const { status } = getStockStatus(quantity);

    const newItem = {
        id: newId,
        name: name,
        category: category,
        quantity: quantity,
        status: status, 
        lastUpdated: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    };

    inventoryData.push(newItem);
    inventoryData.sort((a,b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()); 
    
    closeDialog(addItemDialog);
    populateCategoryFilter(); 
    renderTable(); 

    if (quantity === 0) {
        showToast('error', `${name} added but OUT OF STOCK!`, 'Item needs immediate stocking.');
    } else if (quantity < 20) {
        showToast('warning', `${name} added but LOW ON STOCK!`, `Only ${quantity} units - Consider restocking soon.`);
    } else {
        showToast('success', `${name} added successfully!`, `Initial stock: ${quantity} units.`);
    }
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


// --- Initialization ---

/**
 * Initializes the application, running once when the DOM is ready.
 */
function init() {
    // Initial Render
    populateCategoryFilter();
    renderTable(); 

    // Attach static listeners
    searchInput.addEventListener('input', handleSearch);
    categoryFilterSelect.addEventListener('change', handleCategoryFilter);
    // Attach sort handler to ALL sort buttons
    sortButtons.forEach(button => button.addEventListener('click', handleSort));

    // Add Item Dialog buttons
    addItemButtonMobile.addEventListener('click', showAddItemDialog);
    addItemButtonDesktop.addEventListener('click', showAddItemDialog);
    confirmAddItemButton.addEventListener('click', handleAddItem);
    cancelAddItemButton.addEventListener('click', () => closeDialog(addItemDialog));

    // Stock Dialog Close/Cancel listeners
    document.getElementById('cancel-stock-in').addEventListener('click', () => closeDialog(stockInDialog));
    document.getElementById('cancel-stock-out').addEventListener('click', () => closeDialog(stockOutDialog));

    // Stock Dialog Confirm listeners
    document.getElementById('confirm-stock-in').addEventListener('click', () => handleStockUpdate('in'));
    document.getElementById('confirm-stock-out').addEventListener('click', () => handleStockUpdate('out'));
}

// Ensure the DOM is fully loaded before running init()
document.addEventListener('DOMContentLoaded', init);