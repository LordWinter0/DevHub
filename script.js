// Ensure React and ReactDOM are available globally from CDN in index.html
// Also ensure Firebase modules are exposed globally (e.g., via window.firebase) from index.html

const { useState, useEffect, createContext, useContext, useCallback } = React;
const { createRoot } = ReactDOM; // Use createRoot for React 18+
const { initializeApp, getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, getFirestore, collection, addDoc, onSnapshot, query, orderBy, doc, getDoc, updateDoc, arrayUnion } = window.firebase; // Access Firebase modules from window

// Global variables for Firebase config, replace with your actual values if needed outside Canvas
// These are read from window, set in index.html for easier configuration by user
const appId = window.__app_id || 'default-app-id';
const firebaseConfig = JSON.parse(window.__firebase_config || '{}');
const initialAuthToken = window.__initial_auth_token; // Will typically be null for standalone use

// Context to provide Firebase services and user data throughout the app
const FirebaseContext = createContext(null);

// Custom hook to use Firebase services
const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    console.error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

function App() {
  const [firebaseApp, setFirebaseApp] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null); // This is the displayed user ID
  const [firebaseUser, setFirebaseUser] = useState(null); // Stores the actual Firebase User object
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null); // State to manage selected project for detail view
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success'); // 'success' or 'error'

  // Function to show toast messages
  const showToast = useCallback((message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    const timer = setTimeout(() => {
      setToastMessage('');
    }, 3000); // Hide after 3 seconds
    return () => clearTimeout(timer);
  }, []);


  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    // Check if firebaseConfig is not empty
    if (Object.keys(firebaseConfig).length === 0) {
      console.error("Firebase config is missing. Please ensure 'window.__firebase_config' is provided and valid.");
      setIsAuthReady(true); // Unblock loading even if config is missing
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setFirebaseApp(app);
      setDb(firestore);
      setAuth(firebaseAuth);

      // Listen for authentication state changes
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        setFirebaseUser(user); // Always update the Firebase User object
        if (user) {
          // User is signed in (either via custom token or anonymously)
          setUserId(user.uid);
          console.log('User signed in:', user.uid);
        } else {
          // No user currently signed in, attempt to sign in.
          console.log('No user signed in. Attempting authentication.');
          try {
            // In a standalone app, we primarily rely on anonymous sign-in for simplicity
            // The __initial_auth_token is primarily for Canvas environment authentication
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
              console.log('Signed in with custom token.');
            } else {
              // If no custom token, sign in anonymously
              await signInAnonymously(firebaseAuth);
              console.log('Signed in anonymously.');
            }
          } catch (error) {
            console.error('Firebase authentication error:', error);
            // Even if custom token fails, anonymous sign-in will usually work.
            // If all authentication methods fail, assign a random ID but data won't persist.
            setUserId(crypto.randomUUID());
            console.error("Authentication failed. Proceeding with a random user ID for display only. Private data access will be restricted.");
          }
        }
        setIsAuthReady(true); // Authentication listener has completed its initial check
      });

      // Cleanup subscription on unmount
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      setIsAuthReady(true); // Ensure app unblocks even if Firebase init fails
    }
  }, []); // Empty dependency array means this runs once on mount

  // Provide Firebase services via context once ready
  const firebaseContextValue = { firebaseApp, db, auth, userId, firebaseUser, isAuthReady, appId, showToast };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-xl">Loading DevHub...</div>
      </div>
    );
  }

  return (
    <FirebaseContext.Provider value={firebaseContextValue}>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white font-inter p-4 sm:p-6 md:p-8">
        <Header onOpenCreateProject={() => setShowCreateProjectForm(true)} userId={userId} />

        {selectedProjectId ? (
          <ProjectDetailView projectId={selectedProjectId} onBackToDashboard={() => setSelectedProjectId(null)} />
        ) : (
          <Dashboard onSelectProject={setSelectedProjectId} />
        )}

        {/* Project Creation Form Modal */}
        {showCreateProjectForm && (
          <Modal onClose={() => setShowCreateProjectForm(false)}>
            <CreateProjectForm onClose={() => setShowCreateProjectForm(false)} />
          </Modal>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className={`fixed bottom-4 right-4 p-3 rounded-lg shadow-xl text-white ${toastType === 'success' ? 'bg-green-500' : 'bg-red-500'} z-[9999]`}>
            {toastMessage}
          </div>
        )}
      </div>
    </FirebaseContext.Provider>
  );
}

// Header Component
const Header = ({ onOpenCreateProject, userId }) => {
  return (
    <header className="flex flex-col sm:flex-row items-center justify-between mb-8 p-4 bg-gray-800 rounded-xl shadow-lg">
      <h1 className="text-3xl sm:text-4xl font-bold text-blue-400 mb-4 sm:mb-0">DevHub</h1>
      <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
        <div className="text-sm text-gray-400">User ID: <span className="font-mono text-blue-300 break-all">{userId}</span></div>
        <button
          onClick={onOpenCreateProject}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
        >
          + Create New Project
        </button>
      </div>
    </header>
  );
};

// Dashboard Component to display projects
const Dashboard = ({ onSelectProject }) => {
  const { db, firebaseUser, isAuthReady, appId } = useFirebase();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (db && isAuthReady) {
      if (!firebaseUser || !firebaseUser.uid) {
        setError("Authentication required to load your projects. Please ensure you are signed in.");
        setLoading(false);
        console.warn("Attempted to fetch projects without an authenticated Firebase user (Firestore permission denied likely).");
        return;
      }

      const effectiveUserId = firebaseUser.uid;
      const projectsCollectionRef = collection(db, `artifacts/${appId}/users/${effectiveUserId}/projects`);
      const q = query(projectsCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedProjects = [];
        snapshot.forEach((doc) => {
          fetchedProjects.push({ id: doc.id, ...doc.data() });
        });
        setProjects(fetchedProjects);
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error("Error fetching projects:", err);
        setError("Failed to load projects. Please try again later. (Error: " + err.message + ")");
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [db, firebaseUser, isAuthReady, appId]); // Add appId to dependency array

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <p className="text-blue-300">Loading projects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 p-4 bg-red-900 bg-opacity-30 rounded-lg">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-gray-200 mb-6">Your Projects</h2>
      {projects.length === 0 ? (
        <div className="bg-gray-800 p-8 rounded-xl shadow-lg text-center text-gray-400">
          <p className="text-lg mb-4">No projects yet. Click "+ Create New Project" to get started!</p>
          <img
            src="https://placehold.co/200x150/374151/D1D5DB?text=No+Projects"
            alt="No Projects Placeholder"
            className="mx-auto rounded-lg"
            onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/200x150/374151/D1D5DB?text=No+Projects` }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onSelectProject={onSelectProject} />
          ))}
        </div>
      )}
    </section>
  );
};

// Project Card Component
const ProjectCard = ({ project, onSelectProject }) => {
  return (
    <div
      className="bg-gray-800 rounded-xl shadow-lg p-6 flex flex-col space-y-4 border border-gray-700 hover:border-blue-500 transition duration-300 ease-in-out transform hover:-translate-y-1 cursor-pointer"
      onClick={() => onSelectProject(project.id)}
    >
      {/* Placeholder for Project Icon/Cover Art */}
      <img
        src={project.iconUrl || `https://placehold.co/100x100/1F2937/F3F4F6?text=${project.name.charAt(0)}`}
        alt={`${project.name} Icon`}
        className="w-20 h-20 rounded-full object-cover mx-auto mb-4 border-2 border-blue-400"
        onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/100x100/1F2937/F3F4F6?text=${project.name.charAt(0)}` }}
      />
      <h3 className="text-xl font-bold text-blue-400 text-center">{project.name}</h3>
      <p className="text-gray-400 text-sm text-center line-clamp-2">{project.description}</p>
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>Status: <span className="font-semibold text-blue-300">{project.status || 'Not Started'}</span></span>
        <span>Progress: <span className="font-semibold text-blue-300">{project.progress || '0%'}</span></span>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>Budget: <span className="font-semibold text-green-400">${(project.initialBudget || 0).toLocaleString()}</span></span>
        <span>Team: <span className="font-semibold text-purple-300">{project.teamMembers ? project.teamMembers.length : 1}</span></span>
      </div>
      <div className="flex justify-center mt-4 space-x-3">
        {/* These buttons will be handled by the onSelectProject click now */}
        <button className="bg-gray-700 hover:bg-gray-600 text-white py-1.5 px-4 rounded-md text-sm transition-colors opacity-50 cursor-not-allowed">
          Open Tasks
        </button>
        <button className="bg-gray-700 hover:bg-gray-600 text-white py-1.5 px-4 rounded-md text-sm transition-colors opacity-50 cursor-not-allowed">
          View Analytics
        </button>
      </div>
    </div>
  );
};

// Modal Component for Create Project Form
const Modal = ({ children, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 text-2xl font-bold"
        >
          &times; {/* Close icon */}
        </button>
        {children}
      </div>
    </div>
  );
};

// Create Project Form Component
const CreateProjectForm = ({ onClose }) => {
  const { db, firebaseUser, appId, showToast } = useFirebase();
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [targetReleaseDate, setTargetReleaseDate] = useState('');
  const [initialBudget, setInitialBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(''); // For success/error messages

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db || !firebaseUser || !firebaseUser.uid) {
      setMessage("Error: Authentication is required to create a project.");
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const projectsCollectionRef = collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects`);
      const newProjectRef = await addDoc(projectsCollectionRef, {
        name: projectName,
        description: description,
        targetReleaseDate: targetReleaseDate,
        initialBudget: parseFloat(initialBudget) || 0,
        createdAt: new Date(),
        status: 'Planning',
        progress: '0%', // Will be calculated based on tasks
        teamMembers: [{ userId: firebaseUser.uid, role: 'Owner', displayName: 'You' }], // Initial team member
        budgetCategories: [ // Default budget categories
          { name: 'General', allocatedAmount: parseFloat(initialBudget) || 0 }
        ]
      });

      // Add project creation event to activity log
      await addDoc(collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${newProjectRef.id}/activityLogs`), {
        timestamp: new Date(),
        type: 'Project Created',
        description: `Project "${projectName}" was created.`,
        userId: firebaseUser.uid
      });

      showToast('Project created successfully!');
      setProjectName('');
      setDescription('');
      setTargetReleaseDate('');
      setInitialBudget('');
      onClose(); // Close the modal after successful creation
    } catch (error) {
      console.error('Error creating project:', error);
      setMessage(`Failed to create project: ${error.message}`);
      showToast(`Failed to create project: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg text-white">
      <h2 className="text-2xl font-bold text-blue-400 mb-6">Create New Game Project</h2>

      <div className="mb-4">
        <label htmlFor="projectName" className="block text-gray-300 text-sm font-semibold mb-2">Project Name</label>
        <input
          type="text"
          id="projectName"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="e.g., Pixel Tycoon, Grow a Garden"
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="description" className="block text-gray-300 text-sm font-semibold mb-2">Short Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows="3"
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="A brief overview of your game project..."
          required
        ></textarea>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="targetReleaseDate" className="block text-gray-300 text-sm font-semibold mb-2">Target Release Date</label>
          <input
            type="date"
            id="targetReleaseDate"
            value={targetReleaseDate}
            onChange={(e) => setTargetReleaseDate(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="initialBudget" className="block text-gray-300 text-sm font-semibold mb-2">Initial Budget ($)</label>
          <input
            type="number"
            id="initialBudget"
            value={initialBudget}
            onChange={(e) => setInitialBudget(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="e.g., 5000"
            min="0"
          />
        </div>
      </div>

      {message && (
        <p className={`text-center text-sm mb-4 ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      )}

      <div className="flex justify-end space-x-4 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </form>
  );
};

// ProjectDetailView Component
const ProjectDetailView = ({ projectId, onBackToDashboard }) => {
  const { db, firebaseUser, appId } = useFirebase();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]); // State for tasks to calculate progress
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks'); // Default tab

  // Fetch project details
  useEffect(() => {
    if (db && firebaseUser && firebaseUser.uid && projectId) {
      const projectDocRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects`, projectId);
      const unsubscribe = onSnapshot(projectDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setProject({ id: docSnap.id, ...docSnap.data() });
          setError(null);
        } else {
          setError("Project not found.");
        }
        setLoading(false);
      }, (err) => {
        console.error("Error fetching project details:", err);
        setError("Failed to load project details. " + err.message);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [db, firebaseUser, projectId, appId]);

  // Fetch tasks for progress calculation
  useEffect(() => {
    if (db && firebaseUser && firebaseUser.uid && projectId) {
      const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/tasks`);
      const unsubscribe = onSnapshot(tasksCollectionRef, (snapshot) => {
        const fetchedTasks = [];
        snapshot.forEach((doc) => fetchedTasks.push({ id: doc.id, ...doc.data() }));
        setTasks(fetchedTasks);
      }, (err) => {
        console.error("Error fetching tasks for progress:", err);
      });
      return () => unsubscribe();
    }
  }, [db, firebaseUser, projectId, appId]);


  // Calculate project progress
  useEffect(() => {
    if (project && tasks.length > 0) {
      const completedTasks = tasks.filter(task => task.status === 'Completed').length;
      const totalTasks = tasks.length;
      const newProgress = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(0) + '%' : '0%';

      // Update project document with new progress if it changed
      if (project.progress !== newProgress && db && firebaseUser && firebaseUser.uid && projectId) {
        const projectDocRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects`, projectId);
        updateDoc(projectDocRef, { progress: newProgress })
          .catch(err => console.error("Error updating project progress:", err));
      }
    } else if (project && tasks.length === 0 && project.progress !== '0%') {
       // If no tasks, set progress to 0%
       if (db && firebaseUser && firebaseUser.uid && projectId) {
        const projectDocRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects`, projectId);
        updateDoc(projectDocRef, { progress: '0%' })
          .catch(err => console.error("Error updating project progress to 0%:", err));
       }
    }
  }, [project, tasks, db, firebaseUser, projectId, appId]);


  if (loading) {
    return <div className="text-center text-blue-300 py-8">Loading project details...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 p-4 bg-red-900 bg-opacity-30 rounded-lg">{error}</div>;
  }

  if (!project) {
    return <div className="text-center text-gray-400 py-8">Project data not available.</div>;
  }

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
      <div className="flex items-center mb-6">
        <button
          onClick={onBackToDashboard}
          className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg mr-4 transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Back to Dashboard
        </button>
        <h2 className="text-3xl font-bold text-blue-400">{project.name}</h2>
      </div>

      <p className="text-gray-400 mb-6">{project.description}</p>

      {/* Tabs for navigation */}
      <div className="flex border-b border-gray-700 mb-6">
        <TabButton isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</TabButton>
        <TabButton isActive={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')}>Tasks</TabButton>
        <TabButton isActive={activeTab === 'budget'} onClick={() => setActiveTab('budget')}>Budget</TabButton>
        <TabButton isActive={activeTab === 'team'} onClick={() => setActiveTab('team')}>Team</TabButton>
        <TabButton isActive={activeTab === 'activity'} onClick={() => setActiveTab('activity')}>Activity Log</TabButton>
        <TabButton isActive={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')}>Analytics</TabButton>
        <TabButton isActive={activeTab === 'resources'} onClick={() => setActiveTab('resources')}>Resources</TabButton>
        <TabButton isActive={activeTab === 'release'} onClick={() => setActiveTab('release')}>Release</TabButton>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && <ProjectOverview project={project} />}
        {activeTab === 'tasks' && <TaskBoard projectId={projectId} />}
        {activeTab === 'budget' && <BudgetOverview projectId={projectId} projectBudgetCategories={project.budgetCategories} initialBudget={project.initialBudget} />}
        {activeTab === 'team' && <TeamManagement projectId={projectId} teamMembers={project.teamMembers} />}
        {activeTab === 'activity' && <ActivityLog projectId={projectId} />}
        {activeTab === 'analytics' && <AnalyticsOverview projectId={projectId} />}
        {activeTab === 'resources' && <ResourceLibrary />}
        {activeTab === 'release' && <ReleasePlanner />}
      </div>
    </div>
  );
};

// Reusable Tab Button Component
const TabButton = ({ children, isActive, onClick }) => (
  <button
    className={`py-2 px-4 text-lg font-semibold transition-colors duration-200 ${
      isActive ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'
    }`}
    onClick={onClick}
  >
    {children}
  </button>
);

// Project Overview Sub-component
const ProjectOverview = ({ project }) => (
  <div className="bg-gray-700 p-6 rounded-lg shadow-inner">
    <h3 className="text-xl font-bold text-gray-200 mb-4">Project Overview</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-300">
      <div><span className="font-semibold">Status:</span> {project.status}</div>
      <div><span className="font-semibold">Progress:</span> {project.progress}</div>
      <div><span className="font-semibold">Target Release:</span> {project.targetReleaseDate}</div>
      <div><span className="font-semibold">Created At:</span> {new Date(project.createdAt.toDate()).toLocaleDateString()}</div>
      <div><span className="font-semibold">Initial Budget:</span> ${project.initialBudget.toLocaleString()}</div>
    </div>
  </div>
);

// TaskBoard Component (Kanban Style)
const TaskBoard = ({ projectId }) => {
  const { db, firebaseUser, appId, showToast } = useFirebase();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateTaskForm, setShowCreateTaskForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null); // State to open task detail modal

  // Define role-based columns (which are the new "statuses" for drag/drop)
  const roles = ['Scripting', 'Building', 'Modelling', 'UI', 'VFX', 'General'];

  useEffect(() => {
    if (db && firebaseUser && firebaseUser.uid && projectId) {
      const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/tasks`);
      const q = query(tasksCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedTasks = [];
        snapshot.forEach((doc) => {
          fetchedTasks.push({ id: doc.id, ...doc.data() });
        });
        setTasks(fetchedTasks);
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error("Error fetching tasks:", err);
        setError("Failed to load tasks. " + err.message);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [db, firebaseUser, projectId, appId]);

  const updateTaskRole = async (taskId, newRole, taskName) => {
    if (db && firebaseUser && firebaseUser.uid && projectId) {
      try {
        const taskDocRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/tasks`, taskId);
        await updateDoc(taskDocRef, { role: newRole });
        console.log(`Task ${taskId} role updated to ${newRole}`);
        showToast(`Task "${taskName}" moved to ${newRole} role.`);
        // Add activity log entry for role change
        await addDoc(collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/activityLogs`), {
          timestamp: new Date(),
          type: 'Task Role Changed',
          description: `Task "${taskName}" moved to "${newRole}" role.`,
          userId: firebaseUser.uid
        });

      } catch (e) {
        console.error("Error updating task role:", e);
        showToast(`Failed to move task: ${e.message}`, 'error');
      }
    }
  };


  if (loading) {
    return <div className="text-center text-blue-300 py-8">Loading tasks...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 p-4 bg-red-900 bg-opacity-30 rounded-lg">{error}</div>;
  }

  return (
    <div className="bg-gray-700 p-6 rounded-xl shadow-inner">
      <h3 className="text-xl font-bold text-gray-200 mb-4">Tasks</h3>
      <button
        onClick={() => setShowCreateTaskForm(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md mb-6 transition duration-300 ease-in-out transform hover:scale-105"
      >
        + Add New Task
      </button>

      {showCreateTaskForm && (
        <Modal onClose={() => setShowCreateTaskForm(false)}>
          <CreateTaskForm projectId={projectId} onClose={() => setShowCreateTaskForm(false)} />
        </Modal>
      )}

      {selectedTask && (
        <Modal onClose={() => setSelectedTask(null)}>
          <TaskDetailModal taskId={selectedTask.id} projectId={projectId} onClose={() => setSelectedTask(null)} />
        </Modal>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {roles.map((role) => (
          <TaskColumn
            key={role}
            role={role}
            tasks={tasks.filter(task => task.role === role)}
            onUpdateTaskRole={updateTaskRole}
            onOpenTaskDetail={setSelectedTask} // Pass the setter to open modal
          />
        ))}
      </div>
    </div>
  );
};

// TaskColumn Component for Kanban
const TaskColumn = ({ role, tasks, onUpdateTaskRole, onOpenTaskDetail }) => {
  const onDragOver = (e) => e.preventDefault(); // Allow drop
  const onDrop = (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const taskName = e.dataTransfer.getData('taskName'); // Get task name for toast
    onUpdateTaskRole(taskId, role, taskName);
  };

  return (
    <div
      className="bg-gray-800 rounded-lg p-4 shadow-md min-h-[300px] flex flex-col"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <h4 className="text-lg font-semibold text-gray-300 mb-4 border-b border-gray-600 pb-2">{role} ({tasks.length})</h4>
      <div className="flex-grow overflow-y-auto pr-2"> {/* Added overflow for scroll */}
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onOpenTaskDetail={onOpenTaskDetail} />
        ))}
        {tasks.length === 0 && <p className="text-gray-500 text-sm mt-4">No tasks in this column.</p>}
      </div>
    </div>
  );
};

// TaskCard Component
const TaskCard = ({ task, onOpenTaskDetail }) => {
  const onDragStart = (e) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('taskName', task.name); // Pass task name for toast
  };

  return (
    <div
      className="bg-gray-700 rounded-lg p-3 mb-3 shadow-sm border border-gray-600 cursor-pointer"
      draggable
      onDragStart={onDragStart}
      onClick={() => onOpenTaskDetail(task)} // Open modal on click
    >
      <h5 className="font-semibold text-blue-300 mb-1">{task.name}</h5>
      <p className="text-gray-400 text-sm mb-2 line-clamp-2">{task.description}</p>
      {task.assignee && <p className="text-xs text-gray-500">Assigned: {task.assignee}</p>}
      {task.dueDate && <p className="text-xs text-gray-500">Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
      {task.priority && <p className="text-xs text-gray-500">Priority: {task.priority}</p>}
      <p className="text-xs text-gray-500">Status: <span className={`font-semibold ${task.status === 'Completed' ? 'text-green-400' : task.status === 'In Progress' ? 'text-yellow-400' : 'text-gray-400'}`}>{task.status}</span></p>

      {/* Removed direct status change buttons, handled in TaskDetailModal now */}
    </div>
  );
};

// Create Task Form Component (Corrected duplicate declaration issue)
const CreateTaskForm = ({ projectId, onClose }) => {
  const { db, firebaseUser, appId, showToast } = useFirebase();
  const [taskName, setTaskName] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [role, setRole] = useState('General');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const rolesOptions = ['Scripting', 'Building', 'Modelling', 'UI', 'VFX', 'General'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db || !firebaseUser || !firebaseUser.uid || !projectId) {
      setMessage("Error: Authentication or project context is missing.");
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const tasksCollectionRef = collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/tasks`);
      const newTaskRef = await addDoc(tasksCollectionRef, {
        name: taskName,
        description: description,
        assignee: assignee || 'Unassigned',
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        priority: priority,
        role: role,
        status: 'To Do',
        createdAt: new Date(),
        createdBy: firebaseUser.uid
      });

      await addDoc(collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/activityLogs`), {
        timestamp: new Date(),
        type: 'Task Created',
        description: `New task "${taskName}" created under ${role} role.`,
        userId: firebaseUser.uid
      });

      showToast('Task created successfully!');
      setTaskName('');
      setDescription('');
      setAssignee('');
      setDueDate('');
      setPriority('Medium');
      setRole('General');
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
      setMessage(`Failed to create task: ${error.message}`);
      showToast(`Failed to create task: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg text-white">
      <h2 className="text-2xl font-bold text-blue-400 mb-6">Add New Task</h2>

      <div className="mb-4">
        <label htmlFor="taskName" className="block text-gray-300 text-sm font-semibold mb-2">Task Name</label>
        <input
          type="text"
          id="taskName"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="e.g., Implement Jump Mechanic"
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="taskDescription" className="block text-gray-300 text-sm font-semibold mb-2">Description</label>
        <textarea
          id="taskDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows="3"
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="Detailed steps for the task..."
        ></textarea>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="assignee" className="block text-gray-300 text-sm font-semibold mb-2">Assignee</label>
          <input
            type="text"
            id="assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="e.g., John Doe"
          />
        </div>
        <div>
          <label htmlFor="dueDate" className="block text-gray-300 text-sm font-semibold mb-2">Due Date</label>
          <input
            type="date"
            id="dueDate"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="priority" className="block text-gray-300 text-sm font-semibold mb-2">Priority</label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label htmlFor="role" className="block text-gray-300 text-sm font-semibold mb-2">Role/Category</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          >
            {rolesOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      {message && (
        <p className={`text-center text-sm mb-4 ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      )}

      <div className="flex justify-end space-x-4 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Adding Task...' : 'Add Task'}
        </button>
      </div>
    </form>
  );
};

// TaskDetailModal Component (for editing tasks)
const TaskDetailModal = ({ taskId, projectId, onClose }) => {
  const { db, firebaseUser, appId, showToast } = useFirebase();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const rolesOptions = ['Scripting', 'Building', 'Modelling', 'UI', 'VFX', 'General'];
  const statusOptions = ['To Do', 'In Progress', 'Ready for Review', 'Completed'];

  // Fetch task details
  useEffect(() => {
    if (db && firebaseUser && firebaseUser.uid && projectId && taskId) {
      const taskDocRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/tasks`, taskId);
      const unsubscribe = onSnapshot(taskDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const fetchedTask = { id: docSnap.id, ...docSnap.data() };
          setTask(fetchedTask);
          setEditName(fetchedTask.name);
          setEditDescription(fetchedTask.description);
          setEditAssignee(fetchedTask.assignee || '');
          setEditDueDate(fetchedTask.dueDate ? fetchedTask.dueDate.split('T')[0] : ''); // Format date for input
          setEditPriority(fetchedTask.priority);
          setEditRole(fetchedTask.role);
          setEditStatus(fetchedTask.status);
          setError(null);
        } else {
          setError("Task not found.");
        }
        setLoading(false);
      }, (err) => {
        console.error("Error fetching task details:", err);
        setError("Failed to load task details. " + err.message);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [db, firebaseUser, projectId, taskId, appId]);

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    if (!db || !firebaseUser || !firebaseUser.uid || !projectId || !taskId) {
      showToast("Error: Authentication or task context is missing.", 'error');
      return;
    }

    setLoading(true);
    try {
      const taskDocRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/tasks`, taskId);
      const oldStatus = task.status;
      const oldRole = task.role;

      await updateDoc(taskDocRef, {
        name: editName,
        description: editDescription,
        assignee: editAssignee,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
        priority: editPriority,
        role: editRole,
        status: editStatus,
        updatedAt: new Date()
      });

      // Add activity log entries for changes
      if (oldStatus !== editStatus) {
        await addDoc(collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/activityLogs`), {
          timestamp: new Date(),
          type: 'Task Status Changed',
          description: `Task "${editName}" status changed from "${oldStatus}" to "${editStatus}".`,
          userId: firebaseUser.uid
        });
      }
      if (oldRole !== editRole) {
        await addDoc(collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/activityLogs`), {
          timestamp: new Date(),
          type: 'Task Role Changed',
          description: `Task "${editName}" role changed from "${oldRole}" to "${editRole}".`,
          userId: firebaseUser.uid
        });
      }
      if (task.name !== editName || task.description !== editDescription || task.assignee !== editAssignee || task.dueDate !== (editDueDate ? new Date(editDueDate).toISOString() : null) || task.priority !== editPriority) {
          await addDoc(collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/activityLogs`), {
            timestamp: new Date(),
            type: 'Task Details Updated',
            description: `Task "${editName}" details were updated.`,
            userId: firebaseUser.uid
        });
      }


      showToast('Task updated successfully!');
      onClose(); // Close modal after update
    } catch (e) {
      console.error('Error updating task:', e);
      setError(`Failed to update task: ${e.message}`);
      showToast(`Failed to update task: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center text-blue-300 py-8">Loading task details...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 p-4 bg-red-900 bg-opacity-30 rounded-lg">{error}</div>;
  }

  if (!task) {
    return <div className="text-center text-gray-400 py-8">Task data not available.</div>;
  }

  return (
    <form onSubmit={handleUpdateTask} className="p-4 rounded-lg text-white">
      <h2 className="text-2xl font-bold text-blue-400 mb-6">Edit Task: {task.name}</h2>

      <div className="mb-4">
        <label htmlFor="editTaskName" className="block text-gray-300 text-sm font-semibold mb-2">Task Name</label>
        <input
          type="text"
          id="editTaskName"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="editTaskDescription" className="block text-gray-300 text-sm font-semibold mb-2">Description</label>
        <textarea
          id="editTaskDescription"
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          rows="3"
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
        ></textarea>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="editAssignee" className="block text-gray-300 text-sm font-semibold mb-2">Assignee</label>
          <input
            type="text"
            id="editAssignee"
            value={editAssignee}
            onChange={(e) => setEditAssignee(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="editDueDate" className="block text-gray-300 text-sm font-semibold mb-2">Due Date</label>
          <input
            type="date"
            id="editDueDate"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="editPriority" className="block text-gray-300 text-sm font-semibold mb-2">Priority</label>
          <select
            id="editPriority"
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label htmlFor="editRole" className="block text-gray-300 text-sm font-semibold mb-2">Role/Category</label>
          <select
            id="editRole"
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          >
            {rolesOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="editStatus" className="block text-gray-300 text-sm font-semibold mb-2">Status</label>
        <select
          id="editStatus"
          value={editStatus}
          onChange={(e) => setEditStatus(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
        >
          {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>

      {error && (
        <p className={`text-center text-sm mb-4 text-red-400`}>
          {error}
        </p>
      )}

      <div className="flex justify-end space-x-4 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};


// BudgetOverview Component
const BudgetOverview = ({ projectId, projectBudgetCategories, initialBudget }) => {
  const { db, firebaseUser, appId, showToast } = useFirebase();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddExpenseForm, setShowAddExpenseForm] = useState(false);
  const [currentInitialBudget, setCurrentInitialBudget] = useState(initialBudget || 0);
  const [editingBudget, setEditingBudget] = useState(false);
  const [newBudgetAmount, setNewBudgetAmount] = useState(initialBudget || 0);
  const [budgetCategories, setBudgetCategories] = useState(projectBudgetCategories || [{ name: 'General', allocatedAmount: initialBudget || 0 }]);
  const [showCategoryEdit, setShowCategoryEdit] = useState(false);


  // Fetch expenses
  useEffect(() => {
    if (db && firebaseUser && firebaseUser.uid && projectId) {
      const expensesCollectionRef = collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/expenses`);
      const q = query(expensesCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedExpenses = [];
        snapshot.forEach((doc) => {
          fetchedExpenses.push({ id: doc.id, ...doc.data() });
        });
        setExpenses(fetchedExpenses);
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error("Error fetching expenses:", err);
        setError("Failed to load expenses. " + err.message);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [db, firebaseUser, projectId, appId]);

  // Update initial budget in Firestore
  const handleUpdateTotalBudget = async () => {
    if (db && firebaseUser && firebaseUser.uid && projectId) {
      setLoading(true);
      try {
        const projectDocRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects`, projectId);
        await updateDoc(projectDocRef, { initialBudget: parseFloat(newBudgetAmount) });
        setCurrentInitialBudget(parseFloat(newBudgetAmount));
        setEditingBudget(false); // Exit editing mode
        setError(null);
        showToast('Total budget updated successfully!');
        // Re-distribute existing budget across categories proportionally or just update general
        const newBudgetCats = budgetCategories.map(cat => ({
          ...cat,
          // Simple proportional adjustment if total changes, or just update the general category's allocated amount
          allocatedAmount: newBudgetAmount > 0 && currentInitialBudget > 0 ? (cat.allocatedAmount / currentInitialBudget) * newBudgetAmount : cat.allocatedAmount // Handle division by zero
        }));
        setBudgetCategories(newBudgetCats); // Update local state for immediate reflection
        // Also update the project document with these adjusted categories
        await updateDoc(projectDocRef, { budgetCategories: newBudgetCats });


        // Add activity log entry for total budget update
        await addDoc(collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/activityLogs`), {
          timestamp: new Date(),
          type: 'Total Budget Updated',
          description: `Total budget updated to $${parseFloat(newBudgetAmount).toLocaleString()}.`,
          userId: firebaseUser.uid
        });


      } catch (e) {
        console.error("Error updating total budget:", e);
        setError(`Failed to update total budget: ${e.message}`);
        showToast(`Failed to update total budget: ${e.message}`, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSaveCategories = async (updatedCategories) => {
    if (db && firebaseUser && firebaseUser.uid && projectId) {
      setLoading(true);
      try {
        const projectDocRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects`, projectId);
        await updateDoc(projectDocRef, { budgetCategories: updatedCategories });
        setBudgetCategories(updatedCategories);
        setShowCategoryEdit(false);
        showToast('Budget categories updated successfully!');

        // Add activity log entry for budget category update
        await addDoc(collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/activityLogs`), {
          timestamp: new Date(),
          type: 'Budget Categories Updated',
          description: `Budget categories were updated.`,
          userId: firebaseUser.uid
        });

      } catch (e) {
        console.error("Error saving categories:", e);
        showToast(`Failed to save categories: ${e.message}`, 'error');
      } finally {
        setLoading(false);
      }
    }
  };


  const totalSpent = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const remainingBudget = currentInitialBudget - totalSpent;

  if (loading) {
    return <div className="text-center text-blue-300 py-8">Loading budget details...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 p-4 bg-red-900 bg-opacity-30 rounded-lg">{error}</div>;
  }

  // Calculate spent per category
  const spentPerCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  return (
    <div className="bg-gray-700 p-6 rounded-xl shadow-inner">
      <h3 className="text-xl font-bold text-gray-200 mb-4">Budget Overview</h3>

      <div className="mb-6 bg-gray-800 p-4 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-center">
        <div className="mb-3 sm:mb-0">
          <p className="text-gray-400 text-sm">Initial Budget:</p>
          {editingBudget ? (
            <input
              type="number"
              value={newBudgetAmount}
              onChange={(e) => setNewBudgetAmount(parseFloat(e.target.value) || 0)}
              className="w-32 p-2 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors text-white"
            />
          ) : (
            <p className="text-green-400 text-2xl font-bold">${currentInitialBudget.toLocaleString()}</p>
          )}
        </div>
        <div className="mb-3 sm:mb-0">
          <p className="text-gray-400 text-sm">Total Spent:</p>
          <p className="text-red-400 text-2xl font-bold">${totalSpent.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Remaining Budget:</p>
          <p className={`${remainingBudget < 0 ? 'text-orange-400' : 'text-blue-400'} text-2xl font-bold`}>
            ${remainingBudget.toLocaleString()}
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {editingBudget ? (
            <button
              onClick={handleUpdateTotalBudget}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors mr-2"
              disabled={loading}
            >
              Save Total
            </button>
          ) : (
            <button
              onClick={() => { setEditingBudget(true); setNewBudgetAmount(currentInitialBudget); }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors"
              disabled={loading}
            >
              Edit Total Budget
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-gray-300">Budget Categories</h4>
        <button
          onClick={() => setShowCategoryEdit(true)}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-1.5 px-4 rounded-lg text-sm transition-colors"
        >
          Edit Categories
        </button>
      </div>

      {showCategoryEdit && (
        <Modal onClose={() => setShowCategoryEdit(false)}>
          <EditBudgetCategoriesForm
            projectId={projectId}
            initialCategories={budgetCategories}
            onSave={handleSaveCategories}
            onClose={() => setShowCategoryEdit(false)}
          />
        </Modal>
      )}


      {budgetCategories.length === 0 ? (
        <p className="text-gray-500 text-sm mb-4">No budget categories defined. Click "Edit Categories" to add some.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {budgetCategories.map((cat, index) => {
            const allocated = cat.allocatedAmount || 0;
            const spent = spentPerCategory[cat.name] || 0;
            const remaining = allocated - spent;
            const percentage = currentInitialBudget > 0 ? ((allocated / currentInitialBudget) * 100).toFixed(1) : 0;
            return (
              <div key={index} className="bg-gray-800 p-4 rounded-lg shadow-sm">
                <p className="font-semibold text-blue-300 text-lg">{cat.name} ({percentage}%)</p>
                <p className="text-gray-400 text-sm">Allocated: <span className="font-semibold text-green-400">${allocated.toLocaleString()}</span></p>
                <p className="text-gray-400 text-sm">Spent: <span className="font-semibold text-red-400">${spent.toLocaleString()}</span></p>
                <p className="text-gray-400 text-sm">Remaining: <span className={`font-semibold ${remaining < 0 ? 'text-orange-400' : 'text-blue-400'}`}>${remaining.toLocaleString()}</span></p>
              </div>
            );
          })}
        </div>
      )}


      <button
        onClick={() => setShowAddExpenseForm(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md mb-6 transition duration-300 ease-in-out transform hover:scale-105"
      >
        + Add New Expense
      </button>

      {showAddExpenseForm && (
        <Modal onClose={() => setShowAddExpenseForm(false)}>
          <AddExpenseForm projectId={projectId} onClose={() => setShowAddExpenseForm(false)} budgetCategories={budgetCategories} />
        </Modal>
      )}

      <h4 className="text-lg font-semibold text-gray-300 mb-3">Recent Expenses</h4>
      {expenses.length === 0 ? (
        <p className="text-gray-500 text-sm">No expenses recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {expenses.map((expense) => (
            <li key={expense.id} className="bg-gray-800 p-3 rounded-lg shadow-sm flex justify-between items-center">
              <div>
                <p className="font-semibold text-blue-300">{expense.description}</p>
                <p className="text-gray-400 text-sm">{expense.category} - {new Date(expense.date).toLocaleDateString()}</p>
              </div>
              <p className="font-bold text-red-400">${expense.amount.toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// EditBudgetCategoriesForm Component
const EditBudgetCategoriesForm = ({ projectId, initialCategories, onSave, onClose }) => {
  const [categories, setCategories] = useState(initialCategories.length > 0 ? initialCategories : [{ name: '', allocatedAmount: 0 }]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCategoryChange = (index, field, value) => {
    const newCategories = [...categories];
    newCategories[index] = { ...newCategories[index], [field]: field === 'allocatedAmount' ? parseFloat(value) || 0 : value };
    setCategories(newCategories);
  };

  const addCategory = () => {
    setCategories([...categories, { name: '', allocatedAmount: 0 }]);
  };

  const removeCategory = (index) => {
    const newCategories = categories.filter((_, i) => i !== index);
    setCategories(newCategories);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (categories.some(cat => !cat.name || cat.name.trim() === '')) {
      setMessage("Category names cannot be empty.");
      return;
    }
    const duplicateCategories = categories.filter((cat, index, self) =>
      index !== self.findIndex((t) => t.name.toLowerCase() === cat.name.toLowerCase())
    );
    if (duplicateCategories.length > 0) {
      setMessage("Duplicate category names are not allowed.");
      return;
    }
    onSave(categories);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg text-white">
      <h2 className="text-2xl font-bold text-blue-400 mb-6">Edit Budget Categories</h2>

      {categories.map((cat, index) => (
        <div key={index} className="flex flex-col sm:flex-row items-center mb-4 p-3 bg-gray-700 rounded-md">
          <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto">
            <div>
              <label htmlFor={`categoryName-${index}`} className="block text-gray-300 text-sm font-semibold mb-1">Name</label>
              <input
                type="text"
                id={`categoryName-${index}`}
                value={cat.name}
                onChange={(e) => handleCategoryChange(index, 'name', e.target.value)}
                className="w-full p-2 rounded-md bg-gray-600 border border-gray-500 focus:outline-none focus:border-blue-500 text-white"
                placeholder="Category Name"
                required
              />
            </div>
            <div>
              <label htmlFor={`allocatedAmount-${index}`} className="block text-gray-300 text-sm font-semibold mb-1">Allocated ($)</label>
              <input
                type="number"
                id={`allocatedAmount-${index}`}
                value={cat.allocatedAmount}
                onChange={(e) => handleCategoryChange(index, 'allocatedAmount', e.target.value)}
                className="w-full p-2 rounded-md bg-gray-600 border border-gray-500 focus:outline-none focus:border-blue-500 text-white"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeCategory(index)}
            className="bg-red-600 hover:bg-red-700 text-white py-1.5 px-3 rounded-md shadow-sm ml-0 sm:ml-4 mt-3 sm:mt-0"
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addCategory}
        className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md mb-4 transition-colors"
      >
        + Add Category
      </button>

      {message && (
        <p className={`text-center text-sm mb-4 text-red-400`}>
          {message}
        </p>
      )}

      <div className="flex justify-end space-x-4 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          Save Categories
        </button>
      </div>
    </form>
  );
};


// Add Expense Form Component
const AddExpenseForm = ({ projectId, onClose, budgetCategories }) => {
  const { db, firebaseUser, appId, showToast } = useFirebase();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(budgetCategories.length > 0 ? budgetCategories[0].name : 'General');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Ensure category dropdown defaults to first available if budgetCategories change
    if (budgetCategories.length > 0 && !budgetCategories.some(cat => cat.name === category)) {
      setCategory(budgetCategories[0].name);
    } else if (budgetCategories.length === 0) {
      setCategory('General'); // Fallback if no categories defined
    }
  }, [budgetCategories, category]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db || !firebaseUser || !firebaseUser.uid || !projectId) {
      setMessage("Error: Authentication or project context is missing.");
      return;
    }
    if (budgetCategories.length === 0 && category === 'General') {
      // Custom modal for confirmation instead of alert/confirm
      setMessage("No budget categories are defined. This expense will be added under 'General'. Proceed?");
      // In a real app, you'd show a custom confirmation modal here.
      // For now, if no categories, we'll just allow it with a warning.
    }

    setLoading(true);
    setMessage('');

    try {
      const expensesCollectionRef = collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/expenses`);
      await addDoc(expensesCollectionRef, {
        description: description,
        amount: parseFloat(amount),
        category: category,
        date: date,
        createdAt: new Date(),
        createdBy: firebaseUser.uid
      });

      showToast('Expense added successfully!');
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);

      // Add activity log entry for expense creation
      await addDoc(collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/activityLogs`), {
        timestamp: new Date(),
        type: 'Expense Added',
        description: `Added expense of $${parseFloat(amount).toLocaleString()} for "${description}" (${category}).`,
        userId: firebaseUser.uid
      });

    } catch (error) {
      console.error('Error adding expense:', error);
      setMessage(`Failed to add expense: ${error.message}`);
      showToast(`Failed to add expense: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg text-white">
      <h2 className="text-2xl font-bold text-blue-400 mb-6">Add New Expense</h2>

      <div className="mb-4">
        <label htmlFor="expenseDescription" className="block text-gray-300 text-sm font-semibold mb-2">Description</label>
        <input
          type="text"
          id="expenseDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="e.g., Software License Fee"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="expenseAmount" className="block text-gray-300 text-sm font-semibold mb-2">Amount ($)</label>
          <input
            type="number"
            id="expenseAmount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="e.g., 99.99"
            min="0"
            step="0.01"
            required
          />
        </div>
        <div>
          <label htmlFor="expenseCategory" className="block text-gray-300 text-sm font-semibold mb-2">Category</label>
          <select
            id="expenseCategory"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          >
            {budgetCategories.length > 0 ? (
              budgetCategories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)
            ) : (
              <option value="General">General (No categories defined)</option>
            )}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="expenseDate" className="block text-gray-300 text-sm font-semibold mb-2">Date</label>
        <input
          type="date"
          id="expenseDate"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          required
        />
      </div>

      {message && (
        <p className={`text-center text-sm mb-4 ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      )}

      <div className="flex justify-end space-x-4 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Adding Expense...' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
};

// TeamManagement Component
const TeamManagement = ({ projectId, teamMembers }) => {
  const { db, firebaseUser, appId, showToast } = useFirebase();
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);

  const handleAddMember = async (newMember) => {
    if (!db || !firebaseUser || !firebaseUser.uid || !projectId) {
      showToast("Error: Authentication or project context is missing.", 'error');
      return;
    }
    if (teamMembers && teamMembers.some(member => member.userId === newMember.userId)) {
      showToast("User is already a member of this project.", 'error');
      return;
    }

    try {
      const projectDocRef = doc(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects`, projectId);
      await updateDoc(projectDocRef, {
        teamMembers: arrayUnion(newMember)
      });
      showToast(`Member ${newMember.displayName || newMember.userId} added successfully!`);

      // Add activity log entry
      await addDoc(collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/activityLogs`), {
        timestamp: new Date(),
        type: 'Team Member Added',
        description: `User "${newMember.displayName || newMember.userId}" joined the team as "${newMember.role}".`,
        userId: firebaseUser.uid
      });

    } catch (e) {
      console.error("Error adding team member:", e);
      showToast(`Failed to add team member: ${e.message}`, 'error');
    }
  };

  return (
    <div className="bg-gray-700 p-6 rounded-xl shadow-inner">
      <h3 className="text-xl font-bold text-gray-200 mb-4">Team Members</h3>
      {teamMembers && teamMembers.length > 0 ? (
        <ul className="space-y-3">
          {teamMembers.map((member, index) => (
            <li key={index} className="bg-gray-800 p-3 rounded-lg shadow-sm flex items-center">
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white font-bold mr-3">
                {member.displayName ? member.displayName.charAt(0).toUpperCase() : member.userId.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="font-semibold text-blue-300 break-all">{member.displayName || member.userId}</p>
                <p className="text-gray-400 text-sm">Role: {member.role}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-sm">No team members added yet.</p>
      )}
      <div className="mt-6">
        <button
          onClick={() => setShowAddMemberForm(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
        >
          + Add New Member
        </button>
      </div>

      {showAddMemberForm && (
        <Modal onClose={() => setShowAddMemberForm(false)}>
          <AddTeamMemberForm onAddMember={handleAddMember} onClose={() => setShowAddMemberForm(false)} />
        </Modal>
      )}
    </div>
  );
};

// AddTeamMemberForm Component
const AddTeamMemberForm = ({ onAddMember, onClose }) => {
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('Member');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const rolesOptions = ['Owner', 'Admin', 'Member', 'Viewer']; // Example roles

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    if (!userId) {
      setMessage("User ID cannot be empty.");
      setLoading(false);
      return;
    }
    // Simple validation for already existing member in current list for quick feedback
    // More robust check would involve fetching teamMembers from project and checking here
    await onAddMember({ userId, displayName: displayName || userId, role });
    setLoading(false);
    onClose(); // Close after attempting to add
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg text-white">
      <h2 className="text-2xl font-bold text-blue-400 mb-6">Add New Team Member</h2>

      <div className="mb-4">
        <label htmlFor="memberUserId" className="block text-gray-300 text-sm font-semibold mb-2">Member User ID</label>
        <input
          type="text"
          id="memberUserId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="Enter user's ID (e.g., from their DevHub header)"
          required
        />
      </div>
      <div className="mb-4">
        <label htmlFor="memberDisplayName" className="block text-gray-300 text-sm font-semibold mb-2">Display Name (Optional)</label>
        <input
          type="text"
          id="memberDisplayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="e.g., Alice Programmer"
        />
      </div>
      <div className="mb-4">
        <label htmlFor="memberRole" className="block text-gray-300 text-sm font-semibold mb-2">Role</label>
        <select
          id="memberRole"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
        >
          {rolesOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>

      {message && (
        <p className={`text-center text-sm mb-4 text-red-400`}>
          {message}
        </p>
      )}

      <div className="flex justify-end space-x-4 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? 'Adding...' : 'Add Member'}
        </button>
      </div>
    </form>
  );
};


// ActivityLog Component
const ActivityLog = ({ projectId }) => {
  const { db, firebaseUser, appId } = useFirebase();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (db && firebaseUser && firebaseUser.uid && projectId) {
      const activityCollectionRef = collection(db, `artifacts/${appId}/users/${firebaseUser.uid}/projects/${projectId}/activityLogs`);
      const q = query(activityCollectionRef, orderBy('timestamp', 'desc')); // Order by newest first

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedActivities = [];
        snapshot.forEach((doc) => {
          fetchedActivities.push({ id: doc.id, ...doc.data() });
        });
        setActivities(fetchedActivities);
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error("Error fetching activity log:", err);
        setError("Failed to load activity log. " + err.message);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [db, firebaseUser, projectId, appId]);

  if (loading) {
    return <div className="text-center text-blue-300 py-8">Loading activity log...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 p-4 bg-red-900 bg-opacity-30 rounded-lg">{error}</div>;
  }

  return (
    <div className="bg-gray-700 p-6 rounded-xl shadow-inner">
      <h3 className="text-xl font-bold text-gray-200 mb-4">Project Activity Log</h3>
      {activities.length === 0 ? (
        <p className="text-gray-500 text-sm">No recent activity for this project.</p>
      ) : (
        <ul className="space-y-4">
          {activities.map((activity) => (
            <li key={activity.id} className="bg-gray-800 p-4 rounded-lg shadow-sm">
              <div className="flex items-center text-gray-400 text-xs mb-1">
                <span className="font-semibold text-blue-300 mr-2">{new Date(activity.timestamp.toDate()).toLocaleString()}</span>
                <span>by {activity.userId}</span> {/* Could map to display name if a user lookup is implemented */}
              </div>
              <p className="text-gray-300">
                <span className="font-bold text-green-400 mr-2">{activity.type}:</span>
                {activity.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// New Features: AnalyticsOverview, ResourceLibrary, ReleasePlanner

// AnalyticsOverview Component (AI-Powered Insights Placeholder)
const AnalyticsOverview = ({ projectId }) => {
  const { db, firebaseUser, showToast } = useFirebase();
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState(null);

  const fetchAiInsights = async () => {
    setLoadingInsights(true);
    setAiInsights(null);
    setError(null);

    // Prompt for Gemini API
    const prompt = "Generate a market trend analysis for a casual mobile game with puzzle and simulation elements. Focus on current player retention strategies and monetization trends.";
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    const apiKey = ""; // This API key is usually provided by the environment for tool calls.
                       // For direct fetch calls outside a platform like Canvas, you'd need to manage it.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        setAiInsights(result.candidates[0].content.parts[0].text);
        showToast('AI insights generated!');
      } else {
        setError('Failed to generate AI insights: Unexpected API response structure.');
        showToast('Failed to generate AI insights.', 'error');
      }
    } catch (e) {
      console.error('Error fetching AI insights:', e);
      setError(`Error fetching AI insights: ${e.message}. This feature relies on external API access which might be restricted in this environment or require an explicit API key setup.`);
      showToast(`Error fetching AI insights: ${e.message}`, 'error');
    } finally {
      setLoadingInsights(false);
    }
  };


  return (
    <div className="bg-gray-700 p-6 rounded-xl shadow-inner">
      <h3 className="text-xl font-bold text-gray-200 mb-4">Game Analytics & Insights</h3>
      <p className="text-gray-400 mb-6">
        Here you would typically see key performance indicators (KPIs) like DAU, MAU, Retention, ARPU, etc.,
        and their trends over time. For a full implementation, this would require integration with a live game's
        analytics backend or manual data input.
      </p>

      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-300 mb-3">AI-Powered Market Trend Analysis</h4>
        <p className="text-gray-400 text-sm mb-4">
          Leverage Gemini AI to get insights into market trends relevant to your game's genre and features.
          (Note: This is a simulated call. In a real scenario, you'd feed actual game data or specific queries to the AI.
          **This feature requires network access to the Gemini API, and a valid API key provided by the environment.**)
        </p>
        <button
          onClick={fetchAiInsights}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          disabled={loadingInsights}
        >
          {loadingInsights ? 'Generating Insights...' : 'Generate AI Insights'}
        </button>

        {loadingInsights && (
          <p className="text-blue-300 mt-4">AI is thinking...</p>
        )}
        {error && (
          <p className="text-red-400 mt-4">{error}</p>
        )}
        {aiInsights && (
          <div className="bg-gray-800 p-4 rounded-lg mt-4 max-h-60 overflow-y-auto">
            <h5 className="font-semibold text-blue-300 mb-2">Generated Insights:</h5>
            <p className="text-gray-300 whitespace-pre-wrap">{aiInsights}</p>
          </div>
        )}
      </div>

      {/* Placeholder for actual KPIs/Charts */}
      <div className="mt-8">
        <h4 className="text-lg font-semibold text-gray-300 mb-3">Key Performance Indicators (KPIs) - Placeholder</h4>
        <p className="text-gray-500">
          * Daily Active Users (DAU): [Graph Here] <br/>
          * Monthly Active Users (MAU): [Graph Here] <br/>
          * Average Session Duration: [Graph Here] <br/>
          * Retention Rate (Day 1, Day 7, Day 30): [Graph Here] <br/>
          * Average Revenue Per User (ARPU): [Graph Here] <br/>
          * Conversion Rates: [Graph Here]
        </p>
      </div>
    </div>
  );
};

// ResourceLibrary Component
const ResourceLibrary = () => {
  const resources = [
    {
      category: 'Game Design',
      items: [
        { name: 'GDC Vault (External Link Placeholder)', description: 'Industry talks and presentations.', link: 'https://placehold.co/1x1/000000/FFFFFF?text=GDC' },
        { name: 'Art of Game Design: A Book of Lenses (Concept)', description: 'Framework for thinking about game design.', link: '' },
        { name: 'Narrative Design Principles (Concept)', description: 'Tips for compelling storytelling.', link: '' },
      ],
    },
    {
      category: 'Development Tools',
      items: [
        { name: 'Unity Asset Store (External Link Placeholder)', description: 'Assets for Unity projects.', link: 'https://placehold.co/1x1/000000/FFFFFF?text=Unity' },
        { name: 'Unreal Engine Marketplace (External Link Placeholder)', description: 'Assets for Unreal Engine projects.', link: 'https://placehold.co/1x1/000000/FFFFFF?text=Unreal' },
        { name: 'Visual Studio Code Extensions (Concept)', description: 'Recommended extensions for game dev.', link: '' },
      ],
    },
    {
      category: 'Marketing & Community',
      items: [
        { name: 'Steamworks Documentation (External Link Placeholder)', description: 'Guide to publishing on Steam.', link: 'https://placehold.co/1x1/000000/FFFFFF?text=Steam' },
        { name: 'Discord Server Setup Guide (Concept)', description: 'Best practices for building a community.', link: '' },
        { name: 'Press Kit Template (Concept)', description: 'Downloadable template for your game press kit.', link: '' },
      ],
    },
  ];

  return (
    <div className="bg-gray-700 p-6 rounded-xl shadow-inner">
      <h3 className="text-xl font-bold text-gray-200 mb-4">Resource Library</h3>
      <p className="text-gray-400 mb-6">
        Find useful articles, tools, and templates to aid in your game development journey.
      </p>

      <div className="space-y-6">
        {resources.map((resCategory, index) => (
          <div key={index} className="bg-gray-800 p-4 rounded-lg shadow-md">
            <h4 className="text-lg font-semibold text-blue-300 mb-3">{resCategory.category}</h4>
            <ul className="space-y-2">
              {resCategory.items.map((item, itemIndex) => (
                <li key={itemIndex} className="text-gray-300 text-sm">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 hover:underline flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      {item.name}
                    </a>
                  ) : (
                    <span className="flex items-center">
                       <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2M7 7h10"></path></svg>
                      {item.name}
                    </span>
                  )}
                  <p className="text-gray-500 ml-6 text-xs">{item.description}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

// ReleasePlanner Component
const ReleasePlanner = () => {
  const releasePhases = [
    {
      name: 'Pre-Launch Phase',
      description: 'Activities leading up to the game release.',
      checklists: [
        'Finalize game content and features',
        'Extensive QA and bug fixing',
        'Prepare marketing assets (trailer, screenshots, key art)',
        'Set up store pages (Steam, Epic, Mobile Stores)',
        'Reach out to press and influencers',
        'Prepare community engagement plan',
        'Finalize pricing and monetization strategy',
      ],
    },
    {
      name: 'Launch Day',
      description: 'Critical tasks for the day of release.',
      checklists: [
        'Push "Go Live" button on all platforms',
        'Announce release on all social media channels',
        'Monitor game performance and server status (if applicable)',
        'Engage with early players in community channels',
        'Monitor press coverage and reviews',
      ],
    },
    {
      name: 'Post-Launch (LiveOps) Phase',
      description: 'Ongoing activities to support and grow the game.',
      checklists: [
        'Monitor player feedback and bug reports',
        'Plan and execute content updates and patches',
        'Analyze game data (KPIs, player behavior)',
        'Continue marketing and user acquisition efforts',
        'Community management and events',
        'Consider new monetization opportunities',
      ],
    },
  ];

  return (
    <div className="bg-gray-700 p-6 rounded-xl shadow-inner">
      <h3 className="text-xl font-bold text-gray-200 mb-4">Release Planner</h3>
      <p className="text-gray-400 mb-6">
        Plan your game's launch strategy with these customizable phases and checklists.
      </p>

      <div className="space-y-8">
        {releasePhases.map((phase, index) => (
          <div key={index} className="bg-gray-800 p-5 rounded-lg shadow-md">
            <h4 className="text-xl font-semibold text-blue-300 mb-3">{phase.name}</h4>
            <p className="text-gray-400 mb-4">{phase.description}</p>
            <ul className="space-y-2">
              {phase.checklists.map((item, itemIndex) => (
                <li key={itemIndex} className="flex items-center text-gray-300">
                  <input type="checkbox" className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500 bg-gray-700 border-gray-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

// Mount the App component to the DOM
const rootElement = document.getElementById('root');
if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
} else {
    console.error("Root element with ID 'root' not found in the document.");
}
