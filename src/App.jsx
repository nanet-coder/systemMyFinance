import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider, 
    signInWithPopup 
} from 'firebase/auth';
import { 
    getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp, setLogLevel,
    doc, deleteDoc, setDoc, Timestamp
} from 'firebase/firestore';
import { LogIn, UserPlus, Home, TrendingUp, Settings, BarChart, X, AlertTriangle, Loader, CheckCircle, Mail, Globe, User } from 'lucide-react'; 

// Set Firebase Log Level to debug for development purposes
try {
    setLogLevel('Debug');
} catch (e) {
    console.warn("Could not set Firestore log level:", e);
}

// ------------------------------------------------------------------
// --- 1. GLOBAL FIREBASE INITIALIZATION ---
// ------------------------------------------------------------------
const hardcodedFirebaseConfig = {
    apiKey: "AIzaSyAxxyUPCj8fPU6WUczdph3uMbLEDjMqKQc",
    authDomain: "fir-login-443d5.firebaseapp.com",
    projectId: "fir-login-443d5",
    storageBucket: "fir-login-443d5.firebasestorage.app",
    messagingSenderId: "677371606982",
    appId: "1:677371606982:web:a878a6e713613e6c4424c7",
    measurementId: "G-4V42N5MVRK"
};
const appId = hardcodedFirebaseConfig.appId; 
const firebaseConfig = hardcodedFirebaseConfig;

let app;
let auth;
let db;
let analytics;
let googleProvider;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    // Note: getAnalytics might require specific browser environment setup
    analytics = getAnalytics(app); 
    googleProvider = new GoogleAuthProvider(); 
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

// Default categories (Khmer/English)
const defaultCategories = {
    income: [
        { name: 'ប្រាក់ខែ (Salary)', color: 'bg-green-500/10 text-green-700', isDefault: true },
        { name: 'ជំនួញ (Business)', color: 'bg-emerald-500/10 text-emerald-700', isDefault: true },
        { name: 'ផ្សេងៗ (Other)', color: 'bg-lime-500/10 text-lime-700', isDefault: true }
    ],
    expense: [
        { name: 'អាហារ (Food)', color: 'bg-red-500/10 text-red-700', isDefault: true },
        { name: 'ជួលផ្ទះ (Rent)', color: 'bg-orange-500/10 text-orange-700', isDefault: true },
        { name: 'ដឹកជញ្ជូន (Transport)', color: 'bg-yellow-500/10 text-yellow-700', isDefault: true },
        { name: 'ផ្សេងៗ (Other)', color: 'bg-pink-500/10 text-pink-700', isDefault: true }
    ]
};

// Currency Options
const currencyOptions = [
    { code: 'USD', symbol: '$', name: 'ដុល្លារអាមេរិក (US Dollar)' },
    { code: 'KHR', symbol: '៛', name: 'រៀល (Khmer Riel)' }
];


// ------------------------------------------------------------------
// --- 2. HELPER COMPONENTS (NavItem, ErrorMessage) ---
// ------------------------------------------------------------------

const NavItem = ({ icon: Icon, label, target, currentView, setCurrentView }) => {
    const isActive = currentView === target;
    return (
        <button
            onClick={() => setCurrentView(target)}
            className={`flex items-center w-full md:p-3 py-2 px-3 rounded-xl transition duration-200 text-sm md:text-base font-semibold
                ${isActive
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }
            `}
        >
            <Icon className="w-5 h-5 mr-3" />
            <span className="hidden md:inline">{label}</span>
        </button>
    );
};

const ErrorMessage = ({ message, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full border-t-4 border-red-500">
            <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500 mr-3" />
                <h3 className="text-xl font-bold text-red-600">កំហុស (Error)</h3>
            </div>
            <p className="text-gray-700 mb-6">{message}</p>
            <button
                onClick={onClose}
                className="w-full py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition"
            >
                យល់ព្រម (OK)
            </button>
        </div>
    </div>
);

// ------------------------------------------------------------------
// --- 3. AUTHENTICATION VIEW COMPONENT (Unauthenticated View) ---
// ------------------------------------------------------------------

const AuthView = ({ setError, setSuccessMessage }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                setSuccessMessage("ចូលដោយជោគជ័យ! (Login successful!)");
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                setSuccessMessage("ចុះឈ្មោះដោយជោគជ័យ និងចូលដោយស្វ័យប្រវត្តិ! (Signup successful and logged in automatically!)");
            }
        } catch (e) {
            console.error(e.code, e.message);
            setError(`កំហុស Auth: ${e.code.replace('auth/', '')}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);
        try {
            await signInWithPopup(auth, googleProvider);
            setSuccessMessage("ចូលដោយ Google ដោយជោគជ័យ! (Google login successful!)");
        } catch (e) {
            console.error(e.code, e.message);
            setError(`កំហុស Google Auth: ${e.code.replace('auth/', '')}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleAnonymousSignIn = async () => {
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);
        try {
            await signInAnonymously(auth);
            setSuccessMessage("ចូលជាភ្ញៀវដោយជោគជ័យ! (Guest login successful!)");
        } catch (e) {
            console.error(e.code, e.message);
            setError(`កំហុស Guest Auth: ${e.code.replace('auth/', '')}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl space-y-6">
                <div className="text-center">
                    <h2 className="text-3xl font-extrabold text-indigo-700">
                        {isLogin ? 'ចូលប្រើ (Sign In)' : 'ចុះឈ្មោះ (Sign Up)'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        ដើម្បីបន្តទៅកម្មវិធីគ្រប់គ្រងហិរញ្ញវត្ថុ
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="auth-email" className="block text-sm font-medium text-gray-700">អ៊ីមែល (Email)</label>
                        <input
                            id="auth-email" // Added explicit ID for association
                            name="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="example@mail.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="auth-password" className="block text-sm font-medium text-gray-700">ពាក្យសម្ងាត់ (Password)</label>
                        <input
                            id="auth-password" // Added explicit ID for association
                            name="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="យ៉ាងតិច 6 តួអក្សរ"
                        />
                    </div>
                    
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-200 disabled:opacity-50"
                    >
                        {isLoading && <Loader className="w-5 h-5 animate-spin mr-2" />}
                        {isLogin ? <LogIn className='w-5 h-5 mr-2'/> : <UserPlus className='w-5 h-5 mr-2'/>}
                        {isLogin ? 'ចូលប្រើ (Sign In)' : 'ចុះឈ្មោះ (Sign Up)'}
                    </button>
                </form>

                <div className="flex items-center justify-center">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition duration-200"
                    >
                        {isLogin ? 'មិនទាន់មានគណនី? ចុះឈ្មោះ' : 'មានគណនីរួចហើយ? ចូលប្រើ'}
                    </button>
                </div>
                
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">
                            ឬបន្តជាមួយ
                        </span>
                    </div>
                </div>

                <div className='space-y-3'>
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition duration-200 disabled:opacity-50"
                    >
                        <Globe className="w-5 h-5 mr-2 text-red-500" />
                        ចូលជាមួយ Google
                    </button>
                     <button
                        onClick={handleAnonymousSignIn}
                        disabled={isLoading}
                        className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition duration-200 disabled:opacity-50"
                    >
                        <User className="w-5 h-5 mr-2 text-gray-500" />
                        ចូលជាភ្ញៀវ (Anonymous)
                    </button>
                </div>
            </div>
        </div>
    );
};


// ------------------------------------------------------------------
// --- 4. FINANCE DASHBOARD COMPONENT (Authenticated View) ---
// ------------------------------------------------------------------

const FinanceDashboard = ({ currentUser, handleSignOut }) => {
    const userId = currentUser.uid;

    // Currency States
    const [currencyCode, setCurrencyCode] = useState('USD');
    const [currencySymbol, setCurrencySymbol] = useState('$');

    // App States
    const [transactions, setTransactions] = useState([]);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [totalIncome, setTotalIncome] = useState(0);
    const [totalExpense, setTotalExpense] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentView, setCurrentView] = useState('dashboard'); 
    
    // Category States
    const [userCategories, setUserCategories] = useState({ income: [], expense: [] });
    
    // Combine default and user-defined categories
    const allCategories = {
        income: [...defaultCategories.income, ...userCategories.income],
        expense: [...defaultCategories.expense, ...userCategories.expense],
    };

    // Form States
    const [formType, setFormType] = useState('expense');
    const [formAmount, setFormAmount] = useState('');
    const initialExpenseCategoryName = defaultCategories.expense[0]?.name || '';
    const [formCategory, setFormCategory] = useState(initialExpenseCategoryName);
    const [formDescription, setFormDescription] = useState('');

    // --- Filter States (NEW) ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMonth, setFilterMonth] = useState('all');
    const [filterType, setFilterType] = useState('all');
    // ----------------------------


    // Update form category when type changes (to ensure a valid category is selected)
    useEffect(() => {
        if (formType === 'expense' && !allCategories.expense.some(c => c.name === formCategory)) {
            setFormCategory(allCategories.expense[0]?.name || '');
        } else if (formType === 'income' && !allCategories.income.some(c => c.name === formCategory)) {
            setFormCategory(allCategories.income[0]?.name || '');
        }
    }, [formType, allCategories.expense, allCategories.income, formCategory]);


    // --- Data Listeners: Transactions, Categories, Preferences ---
    useEffect(() => {
        if (!db || !userId) return; 

        // Transaction Listener
        const transactionsPath = `artifacts/${appId}/users/${userId}/transactions`;
        const transactionsRef = collection(db, transactionsPath);

        const unsubscribeTransactions = onSnapshot(query(transactionsRef), (querySnapshot) => {
            const newTransactions = [];
            let income = 0;
            let expense = 0;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const transaction = {
                    id: doc.id,
                    ...data,
                    // Handle serverTimestamp which might be pending (null) or a Timestamp
                    date: data.date instanceof Timestamp ? data.date.toDate() : (data.date ? new Date(data.date.seconds * 1000) : new Date()), 
                };
                newTransactions.push(transaction);

                if (transaction.type === 'income') {
                    income += transaction.amount;
                } else if (transaction.type === 'expense') {
                    expense += transaction.amount;
                }
            });

            // Sort by date, newest first
            newTransactions.sort((a, b) => b.date - a.date); 
            
            setTransactions(newTransactions);
            setTotalIncome(income);
            setTotalExpense(expense);
            setCurrentBalance(income - expense);
            setIsLoading(false);
            setError(null);

        }, (e) => {
            console.error("Error fetching transactions:", e);
            setError("បរាជ័យក្នុងការផ្ទុកប្រតិបត្តិការ។ (Failed to load transactions).");
            setIsLoading(false);
        });

        // Category Listener 
        const categoriesPath = `artifacts/${appId}/users/${userId}/categories`;
        const categoriesRef = collection(db, categoriesPath);
        const unsubscribeCats = onSnapshot(query(categoriesRef), (querySnapshot) => {
            const incomeCats = [];
            const expenseCats = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const category = { id: doc.id, ...data, isDefault: false };
                if (category.type === 'income') {
                    incomeCats.push(category);
                } else if (category.type === 'expense') {
                    expenseCats.push(category);
                }
            });

            setUserCategories({
                income: incomeCats,
                expense: expenseCats
            });
        }, (e) => {
            console.error("Error fetching categories:", e);
        });

        // Currency Preference Listener 
        const preferencesPath = `artifacts/${appId}/users/${userId}/preferences`;
        const preferenceDocRef = doc(db, preferencesPath, 'settings');
        
        const unsubscribePrefs = onSnapshot(preferenceDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const preferredCode = data.currencyCode || 'USD';
                const selectedCurrency = currencyOptions.find(c => c.code === preferredCode) || currencyOptions[0];
                
                setCurrencyCode(selectedCurrency.code);
                setCurrencySymbol(selectedCurrency.symbol);
            } else {
                setCurrencyCode('USD');
                setCurrencySymbol('$');
            }
        }, (e) => {
            console.error("Error fetching preferences:", e);
        });

        return () => {
            unsubscribeTransactions();
            unsubscribeCats();
            unsubscribePrefs();
        };
    }, [userId]); 

    // --- TRANSACTION HANDLER (Clears form and navigates to dashboard on success) ---
    const handleAddTransaction = useCallback(async (e) => {
        e.preventDefault();
        
        if (!db || !userId) {
            setError("Firebase or User ID not available.");
            return;
        }

        const amount = parseFloat(formAmount);
        if (isNaN(amount) || amount <= 0 || !formCategory) {
            setError("សូមបញ្ចូលចំនួនទឹកប្រាក់ត្រឹមត្រូវ និងប្រភេទចំណាត់ថ្នាក់។ (Please enter a valid amount and category).");
            return;
        }

        const newTransaction = {
            type: formType,
            amount: amount,
            category: formCategory,
            description: formDescription || '',
            date: serverTimestamp(),
            userId: userId,
        };

        try {
            const path = `artifacts/${appId}/users/${userId}/transactions`;
            await addDoc(collection(db, path), newTransaction);
            
            // Reset form (Clearing the form)
            setFormAmount('');
            setFormDescription('');
            // Reset category to the first one in the current list
            const resetCategoryName = formType === 'expense' 
                ? allCategories.expense[0]?.name || '' 
                : allCategories.income[0]?.name || '';
            setFormCategory(resetCategoryName);
            
            // Navigate to Dashboard
            setCurrentView('dashboard');
            
        } catch (e) {
            console.error("Error adding document: ", e);
            setError("បរាជ័យក្នុងការបញ្ចូលទិន្នន័យ។ (Failed to add transaction).");
        }
    }, [db, userId, formAmount, formType, formCategory, formDescription, allCategories.expense, allCategories.income]);

    // --- CATEGORY HANDLERS ---
    const handleAddCategory = async (type, name) => {
        if (!db || !userId || !name || name.trim() === '') return;
        
        // Simple validation to prevent adding duplicates of default categories
        const isDuplicateDefault = (type === 'income' ? defaultCategories.income : defaultCategories.expense).some(c => c.name.toLowerCase() === name.trim().toLowerCase());
        if (isDuplicateDefault) {
            setError("មិនអាចបន្ថែមប្រភេទលំនាំដើមឡើងវិញបានទេ។ (Cannot re-add a default category).");
            return;
        }

        const colors = ['blue', 'purple', 'teal', 'indigo', 'orange', 'lime'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const colorClass = `bg-${randomColor}-500/10 text-${randomColor}-700`;

        const newCategory = {
            name: name.trim(),
            type: type,
            color: colorClass
        };

        try {
            const path = `artifacts/${appId}/users/${userId}/categories`;
            await addDoc(collection(db, path), newCategory);
        } catch (e) {
            console.error("Error adding category:", e);
            setError("Failed to add category.");
        }
    };
    
    const handleDeleteCategory = async (categoryId) => {
        if (!db || !userId || !categoryId) return;
        
        try {
            const path = `artifacts/${appId}/users/${userId}/categories/${categoryId}`;
            await deleteDoc(doc(db, path));
        } catch (e) {
            console.error("Error deleting category:", e);
            setError("Failed to delete category.");
        }
    };

    // --- CURRENCY HANDLERS ---
    const handleSaveCurrency = async (newCode) => {
        if (!db || !userId) return;

        try {
            const preferencesPath = `artifacts/${appId}/users/${userId}/preferences`;
            const preferenceDocRef = doc(db, preferencesPath, 'settings');
            
            await setDoc(preferenceDocRef, { 
                currencyCode: newCode, 
                lastUpdated: serverTimestamp() 
            }, { merge: true });
            
            const selectedCurrency = currencyOptions.find(c => c.code === newCode) || currencyOptions[0];
            setCurrencyCode(selectedCurrency.code);
            setCurrencySymbol(selectedCurrency.symbol);

        } catch (e) {
            console.error("Error saving currency preference:", e);
            setError("បរាជ័យក្នុងការរក្សាទុកការកំណត់រូបិយប័ណ្ណ។ (Failed to save currency preference).");
        }
    };

    // --- UTILITY COMPONENTS / FUNCTIONS ---

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { 
            style: 'currency', 
            currency: currencyCode,
            minimumFractionDigits: currencyCode === 'KHR' ? 0 : 2
        }).format(amount);
    };

    const getCategoryColor = (categoryName, type) => {
        const list = type === 'income' ? allCategories.income : allCategories.expense;
        const category = list.find(c => c.name === categoryName);
        return category?.color || 'bg-gray-100 text-gray-800';
    };

    const Header = ({ title }) => (
        <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">
            {title}
        </h1>
    );
    
    // --- MAIN FILTER LOGIC (NEW) ---
    const getFilteredTransactions = () => {
        if (!transactions) return [];

        let filtered = transactions;

        // 1. Filter by Text Search (Category or Description)
        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(t => 
                (t.category && t.category.toLowerCase().includes(lowerCaseSearch)) ||
                (t.description && t.description.toLowerCase().includes(lowerCaseSearch))
            );
        }

        // 2. Filter by Transaction Type (Income/Expense)
        if (filterType !== 'all') {
            filtered = filtered.filter(t => t.type === filterType);
        }

        // 3. Filter by Month
        if (filterMonth !== 'all') {
            // Note: getMonth() returns 0 for January, 11 for December.
            const monthIndex = parseInt(filterMonth) - 1; 
            filtered = filtered.filter(t => {
                if (t.date instanceof Date) {
                    return t.date.getMonth() === monthIndex;
                }
                return false;
            });
        }
        
        return filtered;
    };

    // Calculate the filtered list
    const filteredTransactions = getFilteredTransactions();

    
    // --- Dashboard View ---
    const DashboardView = () => (
        <div className="space-y-6">
            <Header title="ទំព័រដើម (Dashboard)" />
            
            {/* Balance Summary Card */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-indigo-500">
                <p className="text-sm font-medium text-gray-500 mb-2">សមតុល្យបច្ចុប្បន្ន (Current Balance)</p>
                <div className="flex items-center justify-between">
                    <p className={`text-4xl font-extrabold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(currentBalance)}
                    </p>
                    <button 
                        onClick={() => setCurrentView('add')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-full shadow-md transition duration-200 flex items-center gap-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        បញ្ចូលថ្មី
                    </button>
                </div>
            </div>

            {/* Income and Expense Overview */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-md border-l-4 border-green-500">
                    <p className="text-sm font-medium text-gray-500">ចំណូលសរុប (Total Income)</p>
                    <p className="text-2xl font-bold text-green-500">{formatCurrency(totalIncome)}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-md border-l-4 border-red-500">
                    <p className="text-sm font-medium text-gray-500">ចំណាយសរុប (Total Expense)</p>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpense)}</p>
                </div>
            </div>
            
            {/* --- NEW: Filter Controls --- */}
            <div className="bg-white p-4 rounded-xl shadow-lg">
                <h2 className="text-lg font-semibold mb-3 text-gray-700">តម្រង (Filters)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Search Input */}
                    <div>
                        <input
                            type="text"
                            placeholder="ឈ្មោះ/ចំណាំ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    
                    {/* Type Filter */}
                    <div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="all">ប្រភេទទាំងអស់ (All Types)</option>
                            <option value="income">ចំណូល (Income)</option>
                            <option value="expense">ចំណាយ (Expense)</option>
                        </select>
                    </div>

                    {/* Month Filter */}
                    <div>
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="all">ខែទាំងអស់ (All Months)</option>
                            {/* Generate options for months 1 to 12 */}
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                <option key={month} value={month.toString()}>
                                    ខែ {month} / {new Date(0, month - 1).toLocaleString('en-US', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Recent Transactions List - NOW USES FILTERED TRANSACTIONS */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">ប្រតិបត្តិការ ({filteredTransactions.length} រកឃើញ)</h2>
                {isLoading ? (
                    <div className="flex items-center justify-center p-8 text-indigo-600">
                        <Loader className="w-6 h-6 animate-spin mr-2" />
                        <p className="text-gray-500 italic">កំពុងផ្ទុកទិន្នន័យ...</p>
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <p className="text-gray-500 italic p-4 text-center border border-dashed rounded-lg">
                        មិនមានប្រតិបត្តិការត្រូវគ្នាជាមួយនឹងតម្រងទេ។
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {/* Display all filtered transactions, not just the top 8 */}
                        {filteredTransactions.map((t) => ( 
                            <li key={t.id} className="flex justify-between items-center border-b pb-3 last:border-b-0 last:pb-0">
                                <div className="flex items-center space-x-3">
                                    <span className={`p-2 rounded-lg ${getCategoryColor(t.category, t.type)} text-xs font-semibold`}>
                                        {t.type === 'income' ? 'I' : 'E'}
                                    </span>
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">{t.category}</p>
                                        <p className="text-xs text-gray-500">{t.description || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {t.date.toLocaleDateString('km-KH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
    
    // --- Add Transaction View ---
    const AddTransactionView = () => (
        <form onSubmit={handleAddTransaction} className="space-y-6 bg-white p-6 rounded-xl shadow-lg">
            <Header title="បញ្ចូលប្រតិបត្តិការថ្មី (Add New Transaction)" />
            
            {/* Type Selection: Income / Expense */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ប្រភេទ (Type)</label>
                <div className="flex space-x-4 p-1 bg-gray-50 rounded-lg">
                    <button
                        type="button"
                        onClick={() => {
                            setFormType('expense');
                            setFormCategory(allCategories.expense[0]?.name || '');
                        }}
                        className={`w-1/2 py-2 rounded-lg font-semibold transition duration-200 ${
                            formType === 'expense' 
                            ? 'bg-red-500 text-white shadow-md' 
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        ចំណាយ (Expense)
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setFormType('income');
                            setFormCategory(allCategories.income[0]?.name || '');
                        }}
                        className={`w-1/2 py-2 rounded-lg font-semibold transition duration-200 ${
                            formType === 'income' 
                            ? 'bg-green-500 text-white shadow-md' 
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        ចំណូល (Income)
                    </button>
                </div>
            </div>

            {/* Amount Input */}
            <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">ចំនួនទឹកប្រាក់ (Amount - {currencySymbol})</label>
                <input
                    id="amount"
                    name="amount" // Added name attribute
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="ឧទាហរណ៍៖ 15.50"
                    className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 text-lg focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>

            {/* Category Selection */}
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">ប្រភេទចំណាត់ថ្នាក់ (Category)</label>
                <select
                    id="category"
                    name="category" // Added name attribute
                    required
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 text-base focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                    {(formType === 'expense' ? allCategories.expense : allCategories.income).map((cat) => (
                        <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
            </div>

            {/* Description Input */}
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">ចំណាំ (Description)</label>
                <textarea
                    id="description"
                    name="description" // Added name attribute
                    rows="2"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="ទិញអាហារថ្ងៃត្រង់នៅ... / ប្រាក់ខែខែ... "
                    className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm p-3 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                ></textarea>
            </div>

            {/* Submit Button */}
            <div className="flex space-x-4">
                <button
                    type="button"
                    onClick={() => setCurrentView('dashboard')}
                    className="w-1/3 py-3 px-4 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition duration-200"
                >
                    បោះបង់ (Cancel)
                </button>
                <button
                    type="submit"
                    className="w-2/3 py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-200"
                >
                    រក្សាទុកប្រតិបត្តិការ (Save Transaction)
                </button>
            </div>
        </form>
    );

    // --- Settings View ---
    const SettingsView = () => {
        const [newCatName, setNewCatName] = useState('');
        const [newCatType, setNewCatType] = useState('expense');
        const [catSuccessMsg, setCatSuccessMsg] = useState(null);
        
        const handleSubmitNewCategory = (e) => {
            e.preventDefault();
            if (newCatName.trim() !== '') {
                handleAddCategory(newCatType, newCatName).then(() => {
                    setCatSuccessMsg("ប្រភេទថ្មីត្រូវបានបន្ថែមដោយជោគជ័យ។");
                    setTimeout(() => setCatSuccessMsg(null), 3000);
                });
                setNewCatName('');
            }
        };

        return (
            <div className="space-y-8">
                <Header title="ការកំណត់ (Settings)" />

                {/* Navigation and Sign Out */}
                <div className='flex flex-col sm:flex-row justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-md'>
                    <div className='mb-2 sm:mb-0'>
                        <p className="text-sm font-medium text-gray-700">
                            ID អ្នកប្រើប្រាស់: <span className="font-mono text-xs p-1 bg-gray-100 rounded break-all">{userId}</span>
                        </p>
                        <p className="text-sm font-medium text-gray-700">
                            គណនី: <span className="font-mono text-xs p-1 bg-gray-100 rounded break-all">{currentUser.email || (currentUser.isAnonymous ? 'អនាមិក (Anonymous)' : 'N/A')}</span>
                        </p>
                    </div>
                    <button 
                        onClick={handleSignOut}
                        className="bg-red-500 text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-red-600 transition w-full sm:w-auto mt-2 sm:mt-0"
                    >
                        <LogIn className='w-4 h-4 inline mr-1' /> ចេញ (Sign Out)
                    </button>
                </div>
                
                {/* Currency Management Section */}
                <div className="p-4 bg-white rounded-xl border border-blue-200 shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                        <Settings className='w-5 h-5 text-blue-500'/> ការកំណត់រូបិយប័ណ្ណ (Currency Settings)
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">ជ្រើសរើសរូបិយប័ណ្ណគោលដែលអ្នកចង់ប្រើសម្រាប់បង្ហាញ (Choose your preferred display currency).</p>
                    
                    <div className="space-y-3">
                        {currencyOptions.map((option) => (
                            <div 
                                key={option.code}
                                onClick={() => handleSaveCurrency(option.code)}
                                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition duration-200 ${
                                    currencyCode === option.code 
                                        ? 'bg-blue-100 border border-blue-500 shadow-inner' 
                                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl font-bold w-6 text-center">{option.symbol}</span>
                                    <span className="font-medium text-gray-700">{option.name}</span>
                                </div>
                                {currencyCode === option.code && (
                                    <span className="text-blue-600 font-semibold text-xs py-1 px-2 rounded-full bg-blue-50 flex items-center">
                                        <CheckCircle className='w-4 h-4 mr-1'/> បច្ចុប្បន្ន
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-4">**ចំណាំ:** ប្រតិបត្តិការទាំងអស់ត្រូវបានរក្សាទុកជាតម្លៃលេខ ហើយត្រូវបានប្តូរសម្រាប់ការបង្ហាញតែប៉ុណ្ណោះ។</p>
                </div>


                {/* Category Management Section */}
                <div className="p-4 bg-white rounded-xl border border-indigo-200 shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                        <BarChart className='w-5 h-5 text-indigo-500'/> គ្រប់គ្រងប្រភេទ (Category Management)
                    </h3>

                    {/* Add New Category Form */}
                    <form onSubmit={handleSubmitNewCategory} className="space-y-3 mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
                        <h4 className="font-medium text-indigo-700">បង្កើតប្រភេទថ្មី</h4>
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                            <select
                                value={newCatType}
                                onChange={(e) => setNewCatType(e.target.value)}
                                className="w-full sm:w-1/3 p-2 border border-indigo-300 rounded-lg text-sm bg-white"
                            >
                                <option value="expense">ចំណាយ (Expense)</option>
                            <option value="income">ចំណូល (Income)</option>
                            </select>
                            <input
                                type="text"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                placeholder="ឈ្មោះប្រភេទ (ឧ. កាហ្វេ)"
                                required
                                className="w-full sm:w-2/3 p-2 border border-indigo-300 rounded-lg text-sm focus:ring-indigo-500"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition duration-200 shadow-md"
                        >
                            + បន្ថែមប្រភេទ
                        </button>
                        {catSuccessMsg && (
                            <p className="text-sm text-green-600 flex items-center mt-2">
                                <CheckCircle className='w-4 h-4 mr-1' /> {catSuccessMsg}
                            </p>
                        )}
                    </form>
                    
                    {/* Display Categories */}
                    <h4 className="text-lg font-semibold text-gray-700 mb-3">ប្រភេទដែលមានស្រាប់</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Expense Categories */}
                        <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                            <h5 className="font-bold text-red-700 mb-2">ចំណាយ (Expense)</h5>
                            <ul className="space-y-1">
                                {allCategories.expense.map(cat => (
                                    <li key={cat.id || cat.name} className="flex justify-between items-center text-sm p-1 rounded">
                                        <span className={`font-medium ${cat.color}`}>{cat.name}</span>
                                        {!cat.isDefault && (
                                            <button 
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 transition"
                                                title="លុបប្រភេទ"
                                            >
                                                <X className='w-4 h-4'/>
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {/* Income Categories */}
                        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                            <h5 className="font-bold text-green-700 mb-2">ចំណូល (Income)</h5>
                            <ul className="space-y-1">
                                {allCategories.income.map(cat => (
                                    <li key={cat.id || cat.name} className="flex justify-between items-center text-sm p-1 rounded">
                                        <span className={`font-medium ${cat.color}`}>{cat.name}</span>
                                        {!cat.isDefault && (
                                            <button 
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-100 transition"
                                                title="លុបប្រភេទ"
                                            >
                                                <X className='w-4 h-4'/>
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        );
    };


    // --- MAIN RENDER LOGIC ---

    const renderView = () => {
        switch (currentView) {
            case 'dashboard':
                return <DashboardView />;
            case 'add':
                return <AddTransactionView />;
            case 'settings':
                return <SettingsView />;
            default:
                return <DashboardView />;
        }
    };
    
    // Render the main dashboard structure
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
            {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
            
            {/* Sidebar / Mobile Nav */}
            <div className="md:w-64 bg-white shadow-xl md:shadow-none p-4 flex flex-col justify-between fixed bottom-0 left-0 right-0 md:relative md:flex-shrink-0 md:h-screen md:p-6 md:border-r border-t md:border-t-0 z-10">
                
                {/* Desktop Header/Logo */}
                <div className="hidden md:block mb-10">
                    <h1 className="text-2xl font-extrabold text-indigo-600">
                        MyFinance
                    </h1>
                    <p className="text-xs text-gray-500">កម្មវិធីគ្រប់គ្រងហិរញ្ញវត្ថុ</p>
                </div>

                {/* Navigation Items */}
                <nav className="flex md:flex-col justify-around md:justify-start space-x-2 md:space-x-0 md:space-y-2 flex-grow-0 md:flex-grow">
                    <NavItem icon={Home} label="ទំព័រដើម" target="dashboard" currentView={currentView} setCurrentView={setCurrentView} />
                    <NavItem icon={TrendingUp} label="ប្រតិបត្តិការថ្មី" target="add" currentView={currentView} setCurrentView={setCurrentView} />
                    <NavItem icon={Settings} label="ការកំណត់" target="settings" currentView={currentView} setCurrentView={setCurrentView} />
                </nav>

                {/* Sign Out Button (Desktop Only - already in Settings for mobile) */}
                <div className="hidden md:block mt-auto pt-6 border-t">
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center justify-center p-3 rounded-xl transition duration-200 text-sm font-semibold text-red-600 hover:bg-red-50/50"
                    >
                        <LogIn className="w-5 h-5 mr-3" />
                        ចេញ (Sign Out)
                    </button>
                </div>
            </div>
            
            {/* Main Content Area */}
            <main className="flex-grow p-4 md:p-8 pb-20 md:pb-8 max-w-4xl mx-auto w-full">
                {renderView()}
            </main>
        </div>
    );
};


// ------------------------------------------------------------------
// --- 5. MAIN APP CONTAINER ---
// ------------------------------------------------------------------

const FinanceApp = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    
    // Auth State Listener
    useEffect(() => {
        if (!auth) {
            setError("Firebase Auth មិនទាន់បានចាប់ផ្តើមទេ។");
            setIsLoadingAuth(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setIsLoadingAuth(false);
        }, (authError) => {
            console.error("Auth State Error:", authError);
            setError("កំហុសក្នុងការត្រួតពិនិត្យ Auth State។");
            setIsLoadingAuth(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSignOut = useCallback(async () => {
        setError(null);
        try {
            await signOut(auth);
        } catch (e) {
            console.error("Sign Out Error:", e);
            setError("បរាជ័យក្នុងការចេញ។");
        }
    }, []);

    if (isLoadingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="flex flex-col items-center">
                    <Loader className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="mt-4 text-gray-600">កំពុងពិនិត្យ Auth...</p>
                </div>
            </div>
        );
    }

    // Main App View
    return (
        <div className="font-sans antialiased">
            {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
            {successMessage && (
                 <div className="fixed top-4 right-4 z-50 p-4 bg-green-500 text-white rounded-lg shadow-xl flex items-center gap-2">
                    <CheckCircle className='w-5 h-5'/>
                    <p className="text-sm font-semibold">{successMessage}</p>
                    <button onClick={() => setSuccessMessage(null)} className="ml-2">
                        <X className='w-4 h-4'/>
                    </button>
                </div>
            )}
            
            {currentUser ? (
                <FinanceDashboard currentUser={currentUser} handleSignOut={handleSignOut} />
            ) : (
                <AuthView setError={setError} setSuccessMessage={setSuccessMessage} />
            )}
        </div>
    );
};

export default FinanceApp;