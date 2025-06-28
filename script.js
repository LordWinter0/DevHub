// devhub.js

// Global variables for Firebase instances and current project
let db; // Firestore instance
let auth; // Auth instance
let appId; // Application ID from environment
let currentUserId = null; // Current authenticated user's ID
let currentProjectId = null; // ID of the currently selected project
let unsubscribeProjectListeners = []; // Array to store unsubscribe functions for Firestore listeners

// --- DOM Element References ---
const dashboardView = document.getElementById('dashboard-view');
const projectOverviewView = document.getElementById('project-overview-view');
const projectTasksView = document.getElementById('project-tasks-view');
const projectBudgetView = document.getElementById('project-budget-view');
const projectTeamView = document.getElementById('project-team-view');
const projectAnalyticsView = document.getElementById('project-analytics-view');
const projectMarketingView = document.getElementById('project-marketing-view');
const projectCommunityView = document.getElementById('project-community-view');
const projectSections = document.querySelectorAll('.project-section'); // All project-specific sections

const contentArea = document.getElementById('content-area');
const projectSidebar = document.getElementById('project-sidebar');
const projectNavButtons = document.querySelectorAll('.project-nav-btn');

// Create Project Modal elements
const createProjectModal = document.getElementById('create-project-modal');
const createProjectModalContent = document.getElementById('create-project-modal-content');
const showCreateProjectModalBtn = document.getElementById('show-create-project-modal');
const cancelCreateProjectBtn = document.getElementById('cancel-create-project');
const createProjectForm = document.getElementById('create-project-form');
const projectListDiv = document.getElementById('project-list'); // Div to display project cards

// Add/Edit Task Modal elements (repurposed for both adding and editing)
const taskModal = document.getElementById('add-task-modal'); // Renamed from addTaskModal
const taskModalContent = document.getElementById('add-task-modal-content'); // Renamed from addTaskModalContent
const addTaskBtn = document.getElementById('add-task-btn');
const cancelTaskBtn = document.getElementById('cancel-add-task'); // Renamed from cancelAddTaskBtn
const taskForm = document.getElementById('add-task-form'); // Renamed from addTaskForm
const tasksTableBody = document.getElementById('tasks-table-body');
const taskModalTitle = taskModal.querySelector('h2'); // To dynamically change modal title
let isEditingTask = false; // Flag to determine if modal is for edit or add
let currentEditingTaskId = null; // Stores ID of task being edited

// Task form specific fields (to populate for editing)
const taskNameInput = document.getElementById('task-name');
const taskDescriptionInput = document.getElementById('task-description');
const taskStatusSelect = document.getElementById('task-status');
const taskPrioritySelect = document.getElementById('task-priority');
const taskAssigneeInput = document.getElementById('task-assignee');
const taskDueDateInput = document.getElementById('task-due-date');
const taskRoleSelect = document.getElementById('task-role'); // New field for role

// Invite Team Member Modal elements
const inviteTeamModal = document.getElementById('invite-team-modal');
const inviteTeamModalContent = document.getElementById('invite-team-modal-content');
const inviteTeamMemberBtn = document.getElementById('invite-team-member-btn');
const cancelInviteTeamBtn = document.getElementById('cancel-invite-team');
const inviteTeamForm = document.getElementById('invite-team-form');
const teamMembersList = document.getElementById('team-members-list');

// Message Box elements (for alerts/confirmations)
const messageBox = document.getElementById('message-box');
const messageBoxContent = document.getElementById('message-box-content');
const messageBoxTitle = document.getElementById('message-box-title');
const messageBoxText = document.getElementById('message-box-text');
const messageBoxConfirmBtn = document.getElementById('message-box-confirm');
const messageBoxCancelBtn = document.getElementById('message-box-cancel');

// Project detail display elements
const projectSidebarName = document.getElementById('project-sidebar-name');
const currentProjectNameOverview = document.getElementById('current-project-name-overview');
const currentProjectNameTasks = document.getElementById('current-project-name-tasks');
const currentProjectNameBudget = document.getElementById('current-project-name-budget');
const currentProjectNameTeam = document.getElementById('current-project-name-team');
const currentProjectNameAnalytics = document.getElementById('current-project-name-analytics');
const currentProjectNameMarketing = document.getElementById('project-marketing-view'); // Fixed typo
const currentProjectNameCommunity = document.getElementById('current-project-name-community');
const projectDescriptionDisplay = document.getElementById('project-description-display');
const projectPlatformDisplay = document.getElementById('project-platform-display');
const projectGenreDisplay = document.getElementById('project-genre-display');
const projectStartDateDisplay = document.getElementById('project-start-date-display');
const projectEndDateDisplay = document.getElementById('project-end-date-display');

// Budget elements
const totalBudgetInput = document.getElementById('total-budget');
const budgetSpentInput = document.getElementById('budget-spent');
const budgetPercentageSpan = document.getElementById('budget-percentage');
const budgetProgressBar = document.getElementById('budget-progress-bar');
const budgetCategoriesContainer = document.getElementById('budget-categories-container');
const addBudgetCategoryBtn = document.getElementById('add-budget-category-btn');
const currencySymbolSelect = document.getElementById('currency-symbol'); // New: Currency selection

// Budget Transaction Elements (NEW)
const addTransactionBtn = document.getElementById('add-transaction-btn');
const transactionsTableBody = document.getElementById('transactions-table-body');
const transactionModal = document.getElementById('transaction-modal');
const transactionModalContent = document.getElementById('transaction-modal-content');
const cancelTransactionBtn = document.getElementById('cancel-transaction');
const transactionForm = document.getElementById('transaction-form');
const transactionModalTitle = transactionModal.querySelector('h2');
let isEditingTransaction = false;
let currentEditingTransactionId = null;

const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionAmountInput = document.getElementById('transaction-amount');
const transactionDateInput = document.getElementById('transaction-date');
const transactionCategorySelect = document.getElementById('transaction-category');
const transactionTypeExpenseRadio = document.getElementById('transaction-type-expense');
const transactionTypeIncomeRadio = document.getElementById('transaction-type-income');


// --- Utility Functions ---

/**
 * Shows a custom modal message box.
 * @param {string} title - The title of the message box.
 * @param {string} message - The message content.
 * @param {boolean} isConfirm - If true, shows a cancel button for confirmation.
 * @param {function} onConfirm - Callback function when 'OK' or 'Confirm' is clicked.
 * @param {function} [onCancel] - Callback function when 'Cancel' is clicked (only if isConfirm is true).
 */
function showMessageBox(title, message, isConfirm = false, onConfirm, onCancel = () => {}) {
    messageBoxTitle.textContent = title;
    messageBoxText.textContent = message;

    messageBoxCancelBtn.classList.toggle('hidden', !isConfirm);

    // Clear previous event listeners to prevent multiple calls
    messageBoxConfirmBtn.onclick = null;
    messageBoxCancelBtn.onclick = null;

    messageBoxConfirmBtn.onclick = () => {
        hideModal(messageBox, messageBoxContent);
        onConfirm();
    };

    if (isConfirm) {
        messageBoxCancelBtn.onclick = () => {
            hideModal(messageBox, messageBoxContent);
            onCancel();
        };
    }

    showModal(messageBox, messageBoxContent);
}

/**
 * Generic function to show a modal with animation.
 * @param {HTMLElement} modalElement - The modal container element.
 * @param {HTMLElement} modalContentElement - The modal content element for animation.
 */
function showModal(modalElement, modalContentElement) {
    modalElement.classList.remove('hidden');
    // Force reflow for transition to apply
    modalContentElement.offsetWidth;
    modalContentElement.classList.remove('modal-enter-from');
    modalContentElement.classList.add('modal-enter-to');
}

/**
 * Generic function to hide a modal with animation.
 * @param {HTMLElement} modalElement - The modal container element.
 * @param {HTMLElement} modalContentElement - The modal content element for animation.
 */
function hideModal(modalElement, modalContentElement) {
    modalContentElement.classList.remove('modal-enter-to');
    modalContentElement.classList.add('modal-leave-to');

    // Wait for the transition to finish before hiding the element completely
    modalContentElement.addEventListener('transitionend', function handler() {
        modalElement.classList.add('hidden');
        modalContentElement.classList.remove('modal-leave-to');
        modalContentElement.classList.add('modal-enter-from'); // Reset for next show
        modalContentElement.removeEventListener('transitionend', handler);
    }, { once: true });
}


/**
 * Switches the displayed section in the main content area.
 * @param {string} viewId - The ID of the section to show (e.g., 'dashboard-view', 'project-tasks-view').
 */
function switchView(viewId) {
    // Hide all project-specific sections
    projectSections.forEach(section => section.classList.remove('active-view'));
    dashboardView.classList.remove('active-view'); // Also hide dashboard

    // Deactivate all sidebar nav buttons
    projectNavButtons.forEach(btn => btn.classList.remove('bg-blue-700', 'text-white'));

    // Show the requested view
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active-view');
    }

    // If switching to a project view, ensure the sidebar is visible
    if (viewId.startsWith('project-')) {
        projectSidebar.classList.remove('hidden');
        // Activate the corresponding sidebar button
        const activeButton = document.querySelector(`.project-nav-btn[data-section="${viewId.replace('project-', '').replace('-view', '')}"]`);
        if (activeButton) {
            activeButton.classList.add('bg-blue-700', 'text-white');
        }
    } else {
        // If switching to dashboard, hide the sidebar
        projectSidebar.classList.add('hidden');
    }
}

/**
 * Unsubscribes all active Firestore real-time listeners for the current project.
 */
function unsubscribeAllProjectListeners() {
    unsubscribeProjectListeners.forEach(unsubscribe => unsubscribe());
    unsubscribeProjectListeners = []; // Clear the array
    console.log("All previous project listeners unsubscribed.");
}

// --- Firebase Initialization and User Authentication (from HTML, but ensuring access) ---
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to be initialized and authenticated from the inline script in HTML
    const checkFirebaseReady = setInterval(() => {
        if (window.db && window.auth && window.isAuthReady) {
            db = window.db;
            auth = window.auth;
            appId = window.appId;
            currentUserId = auth.currentUser?.uid || crypto.randomUUID(); // Use UID if authenticated, else anonymous
            console.log("Firebase services are ready in JS. Current User ID:", currentUserId);
            clearInterval(checkFirebaseReady);
            loadProjects(); // Load projects once Firebase is ready
        }
    }, 100); // Check every 100ms
});


// --- Project Management Functions ---

/**
 * Loads and displays the user's projects on the dashboard.
 */
async function loadProjects() {
    if (!db || !currentUserId) {
        console.warn("Firestore not initialized or user not authenticated yet. Cannot load projects.");
        return;
    }

    const projectsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/projects`);
    // Use onSnapshot for real-time updates to the project list
    const unsubscribe = onSnapshot(projectsCollectionRef, (snapshot) => {
        projectListDiv.innerHTML = ''; // Clear existing projects

        if (snapshot.empty) {
            projectListDiv.innerHTML = `
                <div class="bg-gray-700 bg-opacity-70 p-6 rounded-2xl shadow-lg text-center opacity-70 border border-blue-600 col-span-full">
                    <p class="text-blue-400">No projects yet. Click "Create Project" to get started!</p>
                </div>
            `;
            return;
        }

        snapshot.forEach(doc => {
            const project = doc.data();
            const projectId = doc.id;
            const projectCard = document.createElement('div');
            projectCard.className = 'bg-gray-700 bg-opacity-70 p-6 rounded-2xl shadow-xl border border-blue-600 transition-transform duration-200 ease-in-out hover:scale-105 hover:shadow-2xl cursor-pointer';
            projectCard.dataset.projectId = projectId;
            projectCard.innerHTML = `
                <h3 class="text-xl font-semibold text-white mb-2">${project.name}</h3>
                <p class="text-blue-300 text-sm mb-4">${project.description || 'No description provided.'}</p>
                <div class="flex flex-wrap gap-2 text-xs text-blue-400">
                    <span><i data-lucide="monitor" class="inline-block w-4 h-4 mr-1"></i>${project.platform || 'N/A'}</span>
                    <span><i data-lucide="gamepad" class="inline-block w-4 h-4 mr-1"></i>${project.genre || 'N/A'}</span>
                    <span><i data-lucide="calendar" class="inline-block w-4 h-4 mr-1"></i>${project.endDate || 'N/A'}</span>
                </div>
            `;
            projectListDiv.appendChild(projectCard);

            // Re-initialize Lucide icons for newly added elements
            lucide.createIcons();

            projectCard.addEventListener('click', () => selectProject(projectId));
        });
        console.log("Projects loaded/updated in real-time.");
    }, (error) => {
        console.error("Error loading projects: ", error);
        showMessageBox("Error", "Failed to load projects. Please try again later.");
    });
    // Store the unsubscribe function if you need to manually stop listening later (e.g., on logout)
    // For now, it will keep listening as long as the page is open.
}


/**
 * Selects a project and loads its details into the project-specific views.
 * @param {string} projectId - The ID of the project to select.
 */
async function selectProject(projectId) {
    if (!db || !currentUserId) {
        console.warn("Firestore not initialized or user not authenticated yet. Cannot select project.");
        showMessageBox("Error", "User not authenticated. Please refresh the page.");
        return;
    }

    // Unsubscribe previous project listeners to prevent data mix-up
    unsubscribeAllProjectListeners();

    currentProjectId = projectId;
    switchView('project-overview-view'); // Default to overview when selecting a project

    const projectDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/projects`, projectId);

    try {
        const projectSnap = await getDoc(projectDocRef);
        if (projectSnap.exists()) {
            const project = projectSnap.data();
            console.log("Selected Project Data:", project);

            // Update project names in headers
            projectSidebarName.textContent = project.name;
            currentProjectNameOverview.textContent = project.name;
            currentProjectNameTasks.textContent = project.name;
            currentProjectNameBudget.textContent = project.name;
            currentProjectNameTeam.textContent = project.name;
            currentProjectNameAnalytics.textContent = project.name;
            currentProjectNameMarketing.textContent = project.name;
            currentProjectNameCommunity.textContent = project.name;

            // Update Overview section details
            projectDescriptionDisplay.textContent = project.description || 'No description provided.';
            projectPlatformDisplay.textContent = project.platform || 'N/A';
            projectGenreDisplay.textContent = project.genre || 'N/A';
            projectStartDateDisplay.textContent = project.startDate || 'N/A';
            projectEndDateDisplay.textContent = project.endDate || 'N/A';

            // Load project-specific data for other sections
            loadProjectTasks(projectId);
            loadProjectBudget(projectId);
            loadProjectTeam(projectId);

        } else {
            console.error("No such project document!");
            showMessageBox("Error", "Project not found.");
            // Revert to dashboard if project not found
            switchView('dashboard-view');
        }
    } catch (error) {
        console.error("Error fetching project details:", error);
        showMessageBox("Error", "Failed to load project details. " + error.message);
        switchView('dashboard-view');
    }
}

// --- Task Management Functions ---

/**
 * Loads and displays tasks for the currently selected project.
 * @param {string} projectId - The ID of the current project.
 */
async function loadProjectTasks(projectId) {
    if (!db || !currentUserId || !projectId) return;

    const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/projects/${projectId}/tasks`);

    const unsubscribe = onSnapshot(tasksCollectionRef, (snapshot) => {
        tasksTableBody.innerHTML = ''; // Clear existing tasks

        if (snapshot.empty) {
            tasksTableBody.innerHTML = `
                <tr class="bg-gray-800 bg-opacity-50">
                    <td colspan="9" class="px-6 py-4 whitespace-nowrap text-sm text-blue-400 text-center">No tasks added yet.</td>
                </tr>
            `;
            return;
        }

        snapshot.forEach(doc => {
            const task = doc.data();
            const taskId = doc.id;

            const row = tasksTableBody.insertRow();
            row.className = 'bg-gray-800 bg-opacity-50'; // Apply base styling
            if (tasksTableBody.rows.length % 2 === 0) { // For alternating row colors
                row.classList.add('bg-gray-700', 'bg-opacity-60');
            }

            // Determine status badge colors
            let statusColorClass = '';
            switch (task.status) {
                case 'To Do':
                    statusColorClass = 'bg-blue-100 text-blue-800';
                    break;
                case 'In Progress':
                    statusColorClass = 'bg-yellow-100 text-yellow-800';
                    break;
                case 'Reviewing': // New status
                    statusColorClass = 'bg-purple-100 text-purple-800';
                    break;
                case 'Completed': // Renamed from 'Done'
                    statusColorClass = 'bg-green-100 text-green-800';
                    break;
                default:
                    statusColorClass = 'bg-gray-100 text-gray-800';
            }

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${task.name || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorClass}">
                        ${task.status || 'N/A'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-300">${task.priority || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-300">${task.assignee || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-300">${task.role || 'N/A'}</td> <!-- New Role column -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-300">${task.dueDate || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-300">${task.progress || '0%'}</td>
                <td class="px-6 py-4 whitespace-normal text-sm text-blue-300 max-w-xs overflow-hidden text-ellipsis">${task.description || 'No notes.'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-blue-400 hover:text-blue-600 mr-3 edit-task-btn" data-id="${taskId}">
                        <i data-lucide="edit" class="w-5 h-5"></i>
                    </button>
                    <button class="text-red-500 hover:text-red-700 delete-task-btn" data-id="${taskId}">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                </td>
            `;

            // Re-initialize Lucide icons for newly added elements
            lucide.createIcons();
        });

        // Add event listeners for edit/delete buttons after rendering
        document.querySelectorAll('.edit-task-btn').forEach(button => {
            button.addEventListener('click', (e) => editTask(e.currentTarget.dataset.id));
        });
        document.querySelectorAll('.delete-task-btn').forEach(button => {
            button.addEventListener('click', (e) => deleteTask(e.currentTarget.dataset.id));
        });

        console.log("Tasks loaded/updated in real-time.");
    }, (error) => {
        console.error("Error loading tasks:", error);
        showMessageBox("Error", "Failed to load tasks for this project.");
    });
    unsubscribeProjectListeners.push(unsubscribe); // Store unsubscribe function
}


/**
 * Handles adding or updating a task to the current project.
 * @param {Event} event - The form submission event.
 */
async function handleTaskFormSubmission(event) {
    event.preventDefault();

    if (!currentProjectId) {
        showMessageBox("Error", "Please select a project first.");
        return;
    }
    if (!db || !currentUserId) {
        showMessageBox("Error", "User not authenticated. Please refresh the page.");
        return;
    }

    const taskData = {
        name: taskNameInput.value.trim(),
        description: taskDescriptionInput.value.trim(),
        status: taskStatusSelect.value,
        priority: taskPrioritySelect.value,
        assignee: taskAssigneeInput.value.trim(),
        dueDate: taskDueDateInput.value,
        role: taskRoleSelect.value // New role field
    };

    if (!taskData.name) {
        showMessageBox("Validation Error", "Task Name is required.");
        return;
    }

    try {
        const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/tasks`);
        if (isEditingTask && currentEditingTaskId) {
            // Update existing task
            const taskDocRef = doc(tasksCollectionRef, currentEditingTaskId);
            await updateDoc(taskDocRef, taskData);
            showMessageBox("Success", "Task updated successfully!");
        } else {
            // Add new task
            taskData.progress = '0%'; // Default progress for new tasks
            taskData.createdAt = new Date().toISOString();
            await addDoc(tasksCollectionRef, taskData);
            showMessageBox("Success", "Task added successfully!");
        }
        taskForm.reset();
        hideModal(taskModal, taskModalContent);
    } catch (error) {
        console.error("Error saving task:", error);
        showMessageBox("Error", "Failed to save task: " + error.message);
    }
}

/**
 * Populates the task modal for editing a task.
 * @param {string} taskId - The ID of the task to edit.
 */
async function editTask(taskId) {
    if (!db || !currentUserId || !currentProjectId) {
        showMessageBox("Error", "System not ready for editing tasks. Please try again.");
        return;
    }

    const taskDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/tasks`, taskId);
    try {
        const taskSnap = await getDoc(taskDocRef);
        if (taskSnap.exists()) {
            const task = taskSnap.data();
            taskModalTitle.textContent = "Edit Task";
            taskNameInput.value = task.name || '';
            taskDescriptionInput.value = task.description || '';
            taskStatusSelect.value = task.status || 'To Do';
            taskPrioritySelect.value = task.priority || 'Low';
            taskAssigneeInput.value = task.assignee || '';
            taskDueDateInput.value = task.dueDate || '';
            taskRoleSelect.value = task.role || 'Programmer'; // Populate new role field

            isEditingTask = true;
            currentEditingTaskId = taskId;
            showModal(taskModal, taskModalContent);
        } else {
            showMessageBox("Error", "Task not found for editing.");
        }
    } catch (error) {
        console.error("Error fetching task for edit:", error);
        showMessageBox("Error", "Failed to load task for editing: " + error.message);
    }
}

/**
 * Handles deleting a task.
 * @param {string} taskId - The ID of the task to delete.
 */
function deleteTask(taskId) {
    showMessageBox(
        "Confirm Deletion",
        "Are you sure you want to delete this task? This action cannot be undone.",
        true, // isConfirm = true
        async () => { // onConfirm callback
            if (!currentProjectId || !db || !currentUserId) {
                showMessageBox("Error", "Project not selected or user not authenticated.");
                return;
            }
            try {
                const taskDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/tasks`, taskId);
                await deleteDoc(taskDocRef);
                showMessageBox("Success", "Task deleted successfully!");
            } catch (error) {
                console.error("Error deleting task:", error);
                showMessageBox("Error", "Failed to delete task: " + error.message);
            }
        },
        () => { // onCancel callback
            console.log("Task deletion cancelled.");
        }
    );
}

// --- Budget Management Functions ---

/**
 * Loads and manages budget data for the selected project, including currency and transactions.
 * @param {string} projectId - The ID of the current project.
 */
async function loadProjectBudget(projectId) {
    if (!db || !currentUserId || !projectId) {
        console.warn("Firestore not initialized or user not authenticated yet. Cannot load budget.");
        return;
    }

    const budgetDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/projects/${projectId}/budget`, 'main_budget');
    const transactionsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/projects/${projectId}/budget/transactions`);

    // Listen for main budget document changes
    const unsubscribeBudget = onSnapshot(budgetDocRef, (docSnap) => {
        let budgetData = { total: 0, currencySymbol: '$', categories: [] };
        if (docSnap.exists()) {
            budgetData = docSnap.data();
            budgetData.categories = budgetData.categories || []; // Ensure categories is an array
            budgetData.currencySymbol = budgetData.currencySymbol || '$'; // Default currency
            console.log("Main Budget data loaded:", budgetData);
        } else {
            console.log("No budget document found, creating default.");
            setDoc(budgetDocRef, budgetData, { merge: true }).catch(e => console.error("Error creating default budget:", e));
        }

        totalBudgetInput.value = budgetData.total || 0;
        currencySymbolSelect.value = budgetData.currencySymbol;
        renderBudgetCategories(budgetData.categories); // Render categories based on allocations
        populateTransactionCategories(budgetData.categories); // Populate categories in transaction modal

        // Add event listener to total budget input only once
        if (!totalBudgetInput.dataset.listenerAttached) {
            totalBudgetInput.addEventListener('change', saveBudgetTotal);
            totalBudgetInput.dataset.listenerAttached = 'true';
        }
        // Add event listener for currency selection
        if (!currencySymbolSelect.dataset.listenerAttached) {
            currencySymbolSelect.addEventListener('change', saveCurrencySymbol);
            currencySymbolSelect.dataset.listenerAttached = 'true';
        }

        // Update progress after rendering categories, before transactions are summed
        updateBudgetProgress();

    }, (error) => {
        console.error("Error loading main budget:", error);
        showMessageBox("Error", "Failed to load main budget data.");
    });
    unsubscribeProjectListeners.push(unsubscribeBudget); // Store unsubscribe function

    // Listen for transactions subcollection changes
    const unsubscribeTransactions = onSnapshot(transactionsCollectionRef, (snapshot) => {
        let totalSpentFromTransactions = 0;
        let totalIncomeFromTransactions = 0;
        const transactions = [];

        if (!snapshot.empty) {
            snapshot.forEach(doc => {
                const transaction = { id: doc.id, ...doc.data() };
                transactions.push(transaction);
                if (transaction.type === 'expense') {
                    totalSpentFromTransactions += parseFloat(transaction.amount) || 0;
                } else if (transaction.type === 'income') {
                    totalIncomeFromTransactions += parseFloat(transaction.amount) || 0;
                }
            });
            console.log("Transactions loaded:", transactions);
        } else {
            console.log("No transactions found.");
        }

        // Update budget spent based on transactions, not category allocations
        // Net spent = total expenses - total income (if considering income against budget)
        // For simplicity, let's just track expenses against the total budget for now.
        // If income contributes to the 'total budget', that's a different model.
        // Sticking to expenses tracked against a fixed 'total estimated budget'.
        budgetSpentInput.value = totalSpentFromTransactions;
        renderTransactions(transactions, currencySymbolSelect.value); // Render transactions
        updateBudgetProgress(); // Recalculate progress after transactions are summed

    }, (error) => {
        console.error("Error loading transactions:", error);
        showMessageBox("Error", "Failed to load budget transactions.");
    });
    unsubscribeProjectListeners.push(unsubscribeTransactions); // Store unsubscribe function
}


/**
 * Renders budget categories into the UI.
 * @param {Array} categories - An array of budget category objects.
 */
function renderBudgetCategories(categories) {
    budgetCategoriesContainer.innerHTML = ''; // Clear existing categories

    if (categories.length === 0) {
        // Add a default category if none exist
        addBudgetCategroyToUI({ name: 'Development', amount: 0 });
        return;
    }

    categories.forEach(category => {
        addBudgetCategroyToUI(category);
    });
    updateBudgetProgress(); // Recalculate progress after rendering
}

/**
 * Adds a new budget category input to the UI.
 * @param {Object} category - The category object {name, amount}.
 */
function addBudgetCategroyToUI(category = { name: '', amount: 0 }) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'flex items-center space-x-4 bg-gray-800 p-4 rounded-xl border border-blue-700';
    categoryDiv.innerHTML = `
        <input type="text" value="${category.name}" placeholder="Category Name" class="budget-category-name flex-1 shadow appearance-none border border-blue-600 rounded-xl py-3 px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        <input type="number" value="${category.amount}" class="budget-category-amount shadow appearance-none border border-blue-600 rounded-xl w-32 py-3 px-4 bg-gray-700 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
        <button class="delete-budget-category-btn text-red-500 hover:text-red-700 transition-colors duration-200">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
        </button>
    `;
    budgetCategoriesContainer.appendChild(categoryDiv);

    lucide.createIcons(); // Initialize new Lucide icons

    // Add event listeners for the new elements
    const nameInput = categoryDiv.querySelector('.budget-category-name');
    const amountInput = categoryDiv.querySelector('.budget-category-amount');
    const deleteBtn = categoryDiv.querySelector('.delete-budget-category-btn');

    nameInput.addEventListener('change', saveBudgetCategories);
    amountInput.addEventListener('change', saveBudgetCategories);
    // Note: amountInput.addEventListener('input', updateBudgetProgress) removed
    // because category amounts are now allocations, not directly "spent"
    // Spent comes from transactions.

    deleteBtn.addEventListener('click', (e) => {
        showMessageBox(
            "Confirm Deletion",
            "Are you sure you want to delete this budget category?",
            true,
            () => {
                categoryDiv.remove();
                saveBudgetCategories(); // Save changes after removal
            }
        );
    });
}

/**
 * Saves the total budget amount to Firestore.
 */
async function saveBudgetTotal() {
    if (!currentProjectId || !db || !currentUserId) return;
    const budgetDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/budget`, 'main_budget');
    try {
        await setDoc(budgetDocRef, { total: parseFloat(totalBudgetInput.value) || 0 }, { merge: true });
        updateBudgetProgress();
        console.log("Total budget updated.");
    } catch (error) {
        console.error("Error saving total budget:", error);
        showMessageBox("Error", "Failed to save total budget.");
    }
}

/**
 * Saves the selected currency symbol to Firestore.
 */
async function saveCurrencySymbol() {
    if (!currentProjectId || !db || !currentUserId) return;
    const budgetDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/budget`, 'main_budget');
    try {
        await setDoc(budgetDocRef, { currencySymbol: currencySymbolSelect.value }, { merge: true });
        // Re-render transactions with new currency symbol if they exist
        // The onSnapshot for transactions will trigger and re-render.
        console.log("Currency symbol updated.");
    } catch (error) {
        console.error("Error saving currency symbol:", error);
        showMessageBox("Error", "Failed to save currency symbol.");
    }
}


/**
 * Saves all budget categories (allocations) to Firestore.
 */
async function saveBudgetCategories() {
    if (!currentProjectId || !db || !currentUserId) return;
    const budgetDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/budget`, 'main_budget');

    const categories = [];
    budgetCategoriesContainer.querySelectorAll('.flex.items-center.space-x-4').forEach(div => {
        const nameInput = div.querySelector('.budget-category-name');
        const amountInput = div.querySelector('.budget-category-amount');
        if (nameInput.value.trim() !== '') { // Only save non-empty category names
            categories.push({
                name: nameInput.value.trim(),
                amount: parseFloat(amountInput.value) || 0
            });
        }
    });

    try {
        await setDoc(budgetDocRef, { categories: categories }, { merge: true });
        populateTransactionCategories(categories); // Update transaction modal categories
        console.log("Budget categories updated.");
    } catch (error) {
        console.error("Error saving budget categories:", error);
        showMessageBox("Error", "Failed to save budget categories.");
    }
}

/**
 * Updates the budget spent amount and the progress bar.
 * Note: budgetSpentInput.value is now updated by transaction listeners.
 * This function primarily updates the UI for progress.
 */
function updateBudgetProgress() {
    const totalBudget = parseFloat(totalBudgetInput.value) || 0;
    const totalSpent = parseFloat(budgetSpentInput.value) || 0; // Read from input, which is updated by transactions

    let percentage = 0;
    if (totalBudget > 0) {
        percentage = (totalSpent / totalBudget) * 100;
    }
    percentage = Math.min(100, Math.max(0, percentage)); // Cap between 0 and 100

    budgetPercentageSpan.textContent = `${percentage.toFixed(1)}%`;
    budgetProgressBar.style.width = `${percentage}%`;

    // Optionally add a visual alert if over budget
    if (totalSpent > totalBudget && totalBudget > 0) {
        budgetProgressBar.classList.remove('bg-blue-500');
        budgetProgressBar.classList.add('bg-red-500');
        showMessageBox("Budget Alert", `You are ${currencySymbolSelect.value}${(totalSpent - totalBudget).toFixed(2)} over budget!`, false);
    } else {
        budgetProgressBar.classList.remove('bg-red-500');
        budgetProgressBar.classList.add('bg-blue-500');
    }
}

// --- Transaction Management Functions (NEW) ---

/**
 * Renders budget transactions into the UI.
 * @param {Array} transactions - An array of transaction objects.
 * @param {string} currencySymbol - The symbol for the selected currency.
 */
function renderTransactions(transactions, currencySymbol = '$') {
    transactionsTableBody.innerHTML = ''; // Clear existing transactions

    if (transactions.length === 0) {
        transactionsTableBody.innerHTML = `
            <tr class="bg-gray-800 bg-opacity-50">
                <td colspan="6" class="px-6 py-4 whitespace-nowrap text-sm text-blue-400 text-center">No transactions logged yet.</td>
            </tr>
        `;
        return;
    }

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, newest first

    transactions.forEach(transaction => {
        const row = transactionsTableBody.insertRow();
        row.className = 'bg-gray-800 bg-opacity-50';
        if (transactionsTableBody.rows.length % 2 === 0) {
            row.classList.add('bg-gray-700', 'bg-opacity-60');
        }

        const amountColorClass = transaction.type === 'expense' ? 'text-red-400' : 'text-green-400';

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-white">${transaction.description || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-300">${transaction.category || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${amountColorClass} font-semibold">${currencySymbol}${parseFloat(transaction.amount || 0).toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-300">${transaction.date || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-300 capitalize">${transaction.type || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button class="text-blue-400 hover:text-blue-600 mr-3 edit-transaction-btn" data-id="${transaction.id}">
                    <i data-lucide="edit" class="w-5 h-5"></i>
                </button>
                <button class="text-red-500 hover:text-red-700 delete-transaction-btn" data-id="${transaction.id}">
                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                </button>
            </td>
        `;
        lucide.createIcons();
    });

    document.querySelectorAll('.edit-transaction-btn').forEach(button => {
        button.addEventListener('click', (e) => editTransaction(e.currentTarget.dataset.id));
    });
    document.querySelectorAll('.delete-transaction-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteTransaction(e.currentTarget.dataset.id));
    });
}

/**
 * Populates the category select dropdown in the transaction modal.
 * @param {Array} categories - An array of budget category objects.
 */
function populateTransactionCategories(categories) {
    transactionCategorySelect.innerHTML = '<option value="">Select Category</option>'; // Default option
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        transactionCategorySelect.appendChild(option);
    });
    // Add an 'Other' option
    const otherOption = document.createElement('option');
    otherOption.value = 'Other';
    otherOption.textContent = 'Other';
    transactionCategorySelect.appendChild(otherOption);
}

/**
 * Handles adding or updating a budget transaction.
 * @param {Event} event - The form submission event.
 */
async function handleTransactionFormSubmission(event) {
    event.preventDefault();

    if (!currentProjectId || !db || !currentUserId) {
        showMessageBox("Error", "System not ready. Please select a project and ensure authentication.");
        return;
    }

    const transactionData = {
        description: transactionDescriptionInput.value.trim(),
        amount: parseFloat(transactionAmountInput.value) || 0,
        date: transactionDateInput.value,
        category: transactionCategorySelect.value,
        type: transactionTypeExpenseRadio.checked ? 'expense' : 'income'
    };

    if (!transactionData.description || transactionData.amount <= 0 || !transactionData.date) {
        showMessageBox("Validation Error", "Please fill in description, a positive amount, and date.");
        return;
    }

    try {
        const transactionsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/budget/transactions`);
        if (isEditingTransaction && currentEditingTransactionId) {
            const transactionDocRef = doc(transactionsCollectionRef, currentEditingTransactionId);
            await updateDoc(transactionDocRef, transactionData);
            showMessageBox("Success", "Transaction updated successfully!");
        } else {
            transactionData.createdAt = new Date().toISOString();
            await addDoc(transactionsCollectionRef, transactionData);
            showMessageBox("Success", "Transaction added successfully!");
        }
        transactionForm.reset();
        hideModal(transactionModal, transactionModalContent);
    } catch (error) {
        console.error("Error saving transaction:", error);
        showMessageBox("Error", "Failed to save transaction: " + error.message);
    }
}

/**
 * Populates the transaction modal for editing.
 * @param {string} transactionId - The ID of the transaction to edit.
 */
async function editTransaction(transactionId) {
    if (!db || !currentUserId || !currentProjectId) return;

    const transactionDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/budget/transactions`, transactionId);
    try {
        const transactionSnap = await getDoc(transactionDocRef);
        if (transactionSnap.exists()) {
            const transaction = transactionSnap.data();
            transactionModalTitle.textContent = "Edit Transaction";
            transactionDescriptionInput.value = transaction.description || '';
            transactionAmountInput.value = transaction.amount || 0;
            transactionDateInput.value = transaction.date || '';
            transactionCategorySelect.value = transaction.category || '';
            if (transaction.type === 'expense') {
                transactionTypeExpenseRadio.checked = true;
            } else {
                transactionTypeIncomeRadio.checked = true;
            }

            isEditingTransaction = true;
            currentEditingTransactionId = transactionId;
            showModal(transactionModal, transactionModalContent);
        } else {
            showMessageBox("Error", "Transaction not found for editing.");
        }
    } catch (error) {
        console.error("Error fetching transaction for edit:", error);
        showMessageBox("Error", "Failed to load transaction for editing: " + error.message);
    }
}

/**
 * Handles deleting a transaction.
 * @param {string} transactionId - The ID of the transaction to delete.
 */
function deleteTransaction(transactionId) {
    showMessageBox(
        "Confirm Deletion",
        "Are you sure you want to delete this transaction? This action cannot be undone.",
        true,
        async () => {
            if (!currentProjectId || !db || !currentUserId) return;
            try {
                const transactionDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/budget/transactions`, transactionId);
                await deleteDoc(transactionDocRef);
                showMessageBox("Success", "Transaction deleted successfully!");
            } catch (error) {
                console.error("Error deleting transaction:", error);
                showMessageBox("Error", "Failed to delete transaction: " + error.message);
            }
        }
    );
}

// --- Team Management Functions ---

/**
 * Loads and displays team members for the currently selected project.
 * @param {string} projectId - The ID of the current project.
 */
async function loadProjectTeam(projectId) {
    if (!db || !currentUserId || !projectId) return;

    const teamCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/projects/${projectId}/team`);

    const unsubscribe = onSnapshot(teamCollectionRef, (snapshot) => {
        teamMembersList.innerHTML = ''; // Clear existing team members

        if (snapshot.empty) {
            teamMembersList.innerHTML = `
                <div class="bg-gray-700 bg-opacity-70 p-6 rounded-2xl shadow-lg text-center opacity-70 border border-blue-600 col-span-full">
                    <p class="text-blue-400">No team members yet. Invite someone!</p>
                </div>
            `;
            return;
        }

        snapshot.forEach(doc => {
            const member = doc.data();
            const memberId = doc.id;
            const memberCard = document.createElement('div');
            memberCard.className = 'bg-gray-700 bg-opacity-70 p-6 rounded-2xl shadow-xl flex flex-col items-center border border-blue-600';
            memberCard.innerHTML = `
                <div class="rounded-full bg-blue-500 w-16 h-16 flex items-center justify-center text-3xl font-bold text-white mb-4">
                    ${member.name ? member.name.charAt(0).toUpperCase() : '?'}
                </div>
                <h3 class="text-xl font-semibold text-white mb-1">${member.name || 'Unknown'}</h3>
                <p class="text-blue-300 text-sm mb-2">${member.role || 'Role Undefined'}</p>
                <p class="text-blue-400 text-xs">${member.email || ''}</p>
                <button class="mt-4 text-red-500 hover:text-red-700 delete-member-btn" data-id="${memberId}">
                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                </button>
            `;
            teamMembersList.appendChild(memberCard);
            lucide.createIcons();
        });

        document.querySelectorAll('.delete-member-btn').forEach(button => {
            button.addEventListener('click', (e) => deleteTeamMember(e.currentTarget.dataset.id));
        });

        console.log("Team members loaded/updated in real-time.");
    }, (error) => {
        console.error("Error loading team members:", error);
        showMessageBox("Error", "Failed to load team members for this project.");
    });
    unsubscribeProjectListeners.push(unsubscribe); // Store unsubscribe function
}

/**
 * Handles inviting a new team member.
 * @param {Event} event - The form submission event.
 */
async function handleInviteTeamMember(event) {
    event.preventDefault();

    if (!currentProjectId) {
        showMessageBox("Error", "Please select a project first.");
        return;
    }
    if (!db || !currentUserId) {
        showMessageBox("Error", "User not authenticated. Please refresh the page.");
        return;
    }

    const memberEmail = document.getElementById('member-email').value.trim();
    const memberRole = document.getElementById('member-role').value.trim();
    const memberName = memberEmail.split('@')[0]; // Simple name extraction from email

    if (!memberEmail) {
        showMessageBox("Validation Error", "Member Email is required.");
        return;
    }

    try {
        const teamCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/team`);
        await addDoc(teamCollectionRef, {
            email: memberEmail,
            role: memberRole,
            name: memberName,
            invitedAt: new Date().toISOString()
        });
        showMessageBox("Success", "Team member invited successfully!");
        inviteTeamForm.reset();
        hideModal(inviteTeamModal, inviteTeamModalContent);
    }
     catch (error) {
        console.error("Error inviting team member:", error);
        showMessageBox("Error", "Failed to invite team member: " + error.message);
    }
}

/**
 * Handles deleting a team member.
 * @param {string} memberId - The ID of the team member to delete.
 */
function deleteTeamMember(memberId) {
    showMessageBox(
        "Confirm Deletion",
        "Are you sure you want to remove this team member from the project?",
        true,
        async () => {
            if (!currentProjectId || !db || !currentUserId) {
                showMessageBox("Error", "Project not selected or user not authenticated.");
                return;
            }
            try {
                const memberDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/projects/${currentProjectId}/team`, memberId);
                await deleteDoc(memberDocRef);
                showMessageBox("Success", "Team member removed successfully!");
            } catch (error) {
                console.error("Error deleting team member:", error);
                showMessageBox("Error", "Failed to remove team member: " + error.message);
            }
        }
    );
}


// --- Event Listeners ---

// Show Create Project Modal
showCreateProjectModalBtn.addEventListener('click', () => {
    createProjectForm.reset(); // Reset form when opening
    showModal(createProjectModal, createProjectModalContent);
});

// Cancel Create Project
cancelCreateProjectBtn.addEventListener('click', () => {
    hideModal(createProjectModal, createProjectModalContent);
});

// Handle Create Project Form Submission
createProjectForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!db || !currentUserId) {
        showMessageBox("Error", "User not authenticated. Please refresh the page.");
        return;
    }

    const projectName = document.getElementById('project-name').value.trim();
    const projectDescription = document.getElementById('project-description').value.trim();
    const projectPlatform = document.getElementById('project-platform').value.trim();
    const projectGenre = document.getElementById('project-genre').value.trim();
    const projectStartDate = document.getElementById('project-start-date').value;
    const projectEndDate = document.getElementById('project-end-date').value;

    if (!projectName) {
        showMessageBox("Validation Error", "Project Name is required.");
        return;
    }

    try {
        const projectsCollectionRef = collection(db, `artifacts/${appId}/users/${currentUserId}/projects`);
        const newProjectRef = await addDoc(projectsCollectionRef, {
            name: projectName,
            description: projectDescription,
            platform: projectPlatform,
            genre: projectGenre,
            startDate: projectStartDate,
            endDate: projectEndDate,
            createdAt: new Date().toISOString()
        });
        showMessageBox("Success", `Project "${projectName}" created successfully!`);
        createProjectForm.reset();
        // Do NOT hide the modal as per requirement, user must click cancel.
        // hideModal(createProjectModal, createProjectModalContent); // Original behavior
        console.log("New project added with ID:", newProjectRef.id);
        // Automatically select the newly created project
        selectProject(newProjectRef.id);
    } catch (error) {
        console.error("Error creating project:", error);
        showMessageBox("Error", "Failed to create project: " + error.message);
    }
});

// Show My Projects (already handled by loadProjects on startup, but can be a manual trigger)
document.getElementById('show-my-projects').addEventListener('click', () => {
    switchView('dashboard-view');
    unsubscribeAllProjectListeners(); // Ensure no project-specific listeners are active
});


// Project Navigation Buttons (Overview, Tasks, Budget, etc.)
projectNavButtons.forEach(button => {
    button.addEventListener('click', () => {
        const section = button.dataset.section;
        if (currentProjectId) {
            switchView(`project-${section}-view`);
        } else {
            showMessageBox("Information", "Please select a project first from the dashboard.");
        }
    });
});

// Add Task Button (opens modal for new task)
addTaskBtn.addEventListener('click', () => {
    if (currentProjectId) {
        taskModalTitle.textContent = "Add New Task";
        taskForm.reset();
        isEditingTask = false;
        currentEditingTaskId = null;
        showModal(taskModal, taskModalContent);
    } else {
        showMessageBox("Information", "Please select a project first to add tasks.");
    }
});

// Cancel Add/Edit Task Button
cancelTaskBtn.addEventListener('click', () => {
    hideModal(taskModal, taskModalContent);
});

// Add/Edit Task Form Submission
taskForm.addEventListener('submit', handleTaskFormSubmission);


// Add Budget Category Button
addBudgetCategoryBtn.addEventListener('click', () => {
    addBudgetCategroyToUI();
    saveBudgetCategories(); // Save the new empty category to Firestore
});

// Add Transaction Button (NEW)
addTransactionBtn.addEventListener('click', () => {
    if (currentProjectId) {
        transactionModalTitle.textContent = "Log New Transaction";
        transactionForm.reset();
        transactionTypeExpenseRadio.checked = true; // Default to expense
        isEditingTransaction = false;
        currentEditingTransactionId = null;
        showModal(transactionModal, transactionModalContent);
    } else {
        showMessageBox("Information", "Please select a project first to log transactions.");
    }
});

// Cancel Transaction Modal (NEW)
cancelTransactionBtn.addEventListener('click', () => {
    hideModal(transactionModal, transactionModalModalContent);
});

// Transaction Form Submission (NEW)
transactionForm.addEventListener('submit', handleTransactionFormSubmission);


// Invite Team Member Button
inviteTeamMemberBtn.addEventListener('click', () => {
    if (currentProjectId) {
        inviteTeamForm.reset();
        showModal(inviteTeamModal, inviteTeamModalContent);
    } else {
        showMessageBox("Information", "Please select a project first to invite team members.");
    }
});

// Cancel Invite Team Button
cancelInviteTeamBtn.addEventListener('click', () => {
    hideModal(inviteTeamModal, inviteTeamModalContent);
});

// Invite Team Form Submission
inviteTeamForm.addEventListener('submit', handleInviteTeamMember);


// Initialize Lucide Icons for static elements when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
});
