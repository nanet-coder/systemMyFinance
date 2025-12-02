import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'; // 💡 IMPORT useMemo
import { initializeApp } from 'firebase/app';
// ... (Firebase imports remain the same) ...
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
// --- 1. GLOBAL FIREBASE INITIALIZATION & CONFIGURATION ---
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
// --- 2. HELPER COMPONENTS (NavItem, ErrorMessage, HEADER) ---
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

const Header = ({ title }) => (
    <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-2">
        {title}
    </h1>
);


// ------------------------------------------------------------------
// --- ISOLATED ADD TRANSACTION VIEW COMPONENT ---
// ------------------------------------------------------------------

const AddTransactionView = React.memo(({ // 💡 ប្រើ React.memo
    allCategories, formType, setFormType, setFormCategory, setFormAmount, 
    setFormDescription, formCategory, formAmount, formDescription, 
    handleAddTransaction, setCurrentView, currencySymbol 
}) => {
    
    // ប្រើ useCallback សម្រាប់ onChange handlers
    const handleAmountChange = useCallback((e) => {
        setFormAmount(e.target.value); 
    }, [setFormAmount]);

    const handleCategoryChange = useCallback((e) => {
        setFormCategory(e.target.value);
    }, [setFormCategory]);

    const handleDescriptionChange = useCallback((e) => {
        setFormDescription(e.target.value);
    }, [setFormDescription]);

    return (
        <form onSubmit={handleAddTransaction} className="space-y-6 bg-white p-6 rounded-xl shadow-lg">
            <Header title="បញ្ចូលប្រតិបត្តិការថ្មី (Add New Transaction)" />
            
            {/* Type Toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                    type="button"
                    onClick={() => setFormType('expense')}
                    className={`flex-1 py-3 text-center font-semibold transition duration-200
                        ${formType === 'expense' ? 'bg-red-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}
                    `}
                >
                    ចំណាយ (Expense)
                </button>
                <button
                    type="button"
                    onClick={() => setFormType('income')}
                    className={`flex-1 py-3 text-center font-semibold transition duration-200
                        ${formType === 'income' ? 'bg-green-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}
                    `}
                >
                    ចំណូល (Income)
                </button>
            </div>
            
            {/* Amount Input */}
            <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                    ចំនួនទឹកប្រាក់ ({currencySymbol})<span className="text-red-500">*</span>
                </label>
                <input
                    id="amount"
                    type="number"
                    required
                    step="0.01"
                    min="0.01"
                    value={formAmount}
                    onChange={handleAmountChange} 
                    className="mt-1 block w-full p-3 border border-gray-300 rounded-lg shadow-sm text-lg focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0.00"
                />
            </div>

            {/* Category Select */}
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                    ប្រភេទចំណាត់ថ្នាក់ (Category)<span className="text-red-500">*</span>
                </label>
                <select
                    id="category"
                    required
                    value={formCategory}
                    onChange={handleCategoryChange} 
                    className="mt-1 block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                    <option value="" disabled>ជ្រើសរើសប្រភេទ...</option>
                    {(formType === 'expense' ? allCategories.expense : allCategories.income).map((cat) => (
                        <option key={cat.name} value={cat.name}>
                            {cat.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Description Input */}
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    ចំណាំ / ពិពណ៌នា (Description) (ស្រេចចិត្ត)
                </label>
                <textarea
                    id="description"
                    value={formDescription}
                    onChange={handleDescriptionChange} 
                    rows="3"
                    className="mt-1 block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="ឧ. ទិញកាហ្វេពេលព្រឹក..."
                />
            </div>

            {/* Submit Button */}
            <button
                type="submit"
                className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-md text-base font-semibold text-white transition duration-200
                    ${formType === 'expense' ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500' : 'bg-green-500 hover:bg-green-600 focus:ring-green-500'}
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                `}
            >
                <CheckCircle className='w-5 h-5 mr-2'/>
                បញ្ចូលប្រតិបត្តិការ
            </button>
            
             <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className="w-full text-center py-2 text-sm text-gray-600 hover:text-indigo-600 transition"
            >
                ត្រឡប់ទៅទំព័រដើមវិញ
            </button>
        </form>
    );
});


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
    
    // 💡 FIX: ប្រើ useMemo ដើម្បីធានាថា allCategories មិនត្រូវបានបង្កើតឡើងវិញរាល់ពេលដែល state ផ្លាស់ប្តូរ
    const allCategories = useMemo(() => {
        return {
            income: [...defaultCategories.income, ...userCategories.income],
            expense: [...defaultCategories.expense, ...userCategories.expense],
        };
    }, [userCategories.income, userCategories.expense]);


    // Form States
    const [formType, setFormType] = useState('expense');
    const [formAmount, setFormAmount] = useState('');
    const initialExpenseCategoryName = allCategories.expense[0]?.name || '';
    const [formCategory, setFormCategory] = useState(initialExpenseCategoryName);
    const [formDescription, setFormDescription] = useState('');

    // 💡 FIX: Use useRef to store mutable form states
    const formAmountRef = useRef(formAmount);
    const formCategoryRef = useRef(formCategory);
    const formDescriptionRef = useRef(formDescription);
    
    // 💡 FIX: Update Ref whenever the State changes
    useEffect(() => {
        formAmountRef.current = formAmount;
        formCategoryRef.current = formCategory;
        formDescriptionRef.current = formDescription;
    }, [formAmount, formCategory, formDescription]);


    // --- Filter States ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMonth, setFilterMonth] = useState('all');
    const [filterType, setFilterType] = useState('all');
    
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
                    date: data.date instanceof Timestamp ? data.date.toDate() : (data.date ? new Date(data.date.seconds * 1000) : new Date()), 
                };
                newTransactions.push(transaction);

                if (transaction.type === 'income') {
                    income += transaction.amount;
                } else if (transaction.type === 'expense') {
                    expense += transaction.amount;
                }
            });

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

    // --- TRANSACTION HANDLER (STABLE CALLBACK) ---
    const handleAddTransaction = useCallback(async (e) => {
        e.preventDefault();
        
        // 💡 ប្រើ Ref ដើម្បីចូលយកតម្លៃចុងក្រោយនៃ Form State
        const currentAmount = formAmountRef.current;
        const currentCategory = formCategoryRef.current;
        const currentDescription = formDescriptionRef.current;
        
        if (!db || !userId) {
            setError("Firebase or User ID not available.");
            return;
        }

        const amount = parseFloat(currentAmount);
        if (isNaN(amount) || amount <= 0 || !currentCategory) {
            setError("សូមបញ្ចូលចំនួនទឹកប្រាក់ត្រឹមត្រូវ និងប្រភេទចំណាត់ថ្នាក់។");
            return;
        }

        const newTransaction = {
            type: formType, 
            amount: amount,
            category: currentCategory,
            description: currentDescription || '',
            date: serverTimestamp(),
            userId: userId,
        };

        try {
            const path = `artifacts/${appId}/users/${userId}/transactions`;
            await addDoc(collection(db, path), newTransaction);
            
            // Reset form 
            setFormAmount('');
            setFormDescription('');
            
            const resetCategoryName = formType === 'expense' 
                ? allCategories.expense[0]?.name || '' 
                : allCategories.income[0]?.name || '';
            setFormCategory(resetCategoryName);
            
            setCurrentView('dashboard');
            
        } catch (e) {
            console.error("Error adding document: ", e);
            setError("បរាជ័យក្នុងការបញ្ចូលទិន្នន័យ។ (Failed to add transaction).");
        }
        // allCategories ត្រូវបានប្រើនៅទីនេះ ប៉ុន្តែដោយសារវាជា useMemo វាស្ថិរភាព
    }, [db, userId, allCategories.expense, allCategories.income, formType, setFormAmount, setFormDescription, setFormCategory, setCurrentView, setError]);

    // --- OTHER UTILITY FUNCTIONS ---
    
    const handleAddCategory = async (type, name) => {
        if (!db || !userId || !name || name.trim() === '') return;
        
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
    
    const getFilteredTransactions = () => {
        if (!transactions) return [];

        let filtered = transactions;

        if (searchTerm) {
            const lowerCaseSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(t => 
                (t.category && t.category.toLowerCase().includes(lowerCaseSearch)) ||
                (t.description && t.description.toLowerCase().includes(lowerCaseSearch))
            );
        }

        if (filterType !== 'all') {
            filtered = filtered.filter(t => t.type === filterType);
        }

        if (filterMonth !== 'all') {
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
            
            {/* --- Filter Controls --- */}
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

            {/* Recent Transactions List */}
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
    
    // --- Settings View (remains the same) ---
    const SettingsView = () => {
        const [newIncomeCat, setNewIncomeCat] = useState('');
        const [newExpenseCat, setNewExpenseCat] = useState('');

        return (
            <div className="space-y-8">
                <Header title="ការកំណត់ (Settings)" />

                {/* Currency Settings */}
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 text-indigo-600">រូបិយប័ណ្ណ (Currency)</h2>
                    <div className="flex flex-col sm:flex-row items-end gap-3">
                        <div className="flex-1 w-full">
                            <label htmlFor="currency-select" className="block text-sm font-medium text-gray-700 mb-1">
                                ជ្រើសរើសរូបិយប័ណ្ណមូលដ្ឋាន
                            </label>
                            <select
                                id="currency-select"
                                value={currencyCode}
                                onChange={(e) => handleSaveCurrency(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                            >
                                {currencyOptions.map(c => (
                                    <option key={c.code} value={c.code}>
                                        {c.name} ({c.symbol})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">បច្ចុប្បន្ន៖ {currencySymbol} ({currencyCode})</p>
                </div>
                
                {/* Category Management */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Income Categories */}
                    <CategoryManagement 
                        title="ប្រភេទចំណូល (Income Categories)"
                        type="income"
                        categories={allCategories.income}
                        newCat={newIncomeCat}
                        setNewCat={setNewIncomeCat}
                        handleAddCategory={handleAddCategory}
                        handleDeleteCategory={handleDeleteCategory}
                        defaultCategories={defaultCategories.income}
                    />

                    {/* Expense Categories */}
                    <CategoryManagement 
                        title="ប្រភេទចំណាយ (Expense Categories)"
                        type="expense"
                        categories={allCategories.expense}
                        newCat={newExpenseCat}
                        setNewCat={setNewExpenseCat}
                        handleAddCategory={handleAddCategory}
                        handleDeleteCategory={handleDeleteCategory}
                        defaultCategories={defaultCategories.expense}
                    />
                </div>

                {/* Account Settings */}
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 text-indigo-600">គណនី (Account)</h2>
                    <p className="text-sm text-gray-700 mb-4">
                        អ្នកកំពុងចូលជា: 
                        <span className="font-medium ml-2">{currentUser.email || (currentUser.isAnonymous ? 'ភ្ញៀវ (Anonymous)' : 'N/A')}</span>
                    </p>
                    <button
                        onClick={handleSignOut}
                        className="w-full py-2 px-4 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition shadow-md"
                    >
                        ចេញពីគណនី (Sign Out)
                    </button>
                </div>
            </div>
        );
    };

    const CategoryManagement = ({ title, type, categories, newCat, setNewCat, handleAddCategory, handleDeleteCategory, defaultCategories }) => (
        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4" style={{borderColor: type === 'income' ? '#10B981' : '#EF4444'}}>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">{title}</h2>
            
            {/* Add New Category Form */}
            <div className="mb-6 space-y-2">
                <input
                    type="text"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder={`បញ្ចូលឈ្មោះប្រភេទ ${type === 'income' ? 'ចំណូល' : 'ចំណាយ'} ថ្មី...`}
                    className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
                <button
                    onClick={() => { handleAddCategory(type, newCat); setNewCat(''); }}
                    disabled={!newCat.trim()}
                    className={`w-full py-2 px-4 font-semibold text-white rounded-lg transition duration-200 disabled:opacity-50
                        ${type === 'income' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}
                    `}
                >
                    បន្ថែមប្រភេទ
                </button>
            </div>

            {/* List of Categories */}
            <h3 className="text-lg font-medium mb-3 border-b pb-1 text-gray-700">ប្រភេទបច្ចុប្បន្ន:</h3>
            <ul className="space-y-2">
                {categories.map((cat, index) => (
                    <li key={cat.id || cat.name} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                        <span className={`font-medium ${cat.isDefault ? 'text-indigo-600' : 'text-gray-800'}`}>
                            {cat.name} {cat.isDefault && '(លំនាំដើម)'}
                        </span>
                        {!cat.isDefault && cat.id && (
                            <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="text-gray-400 hover:text-red-500 transition"
                                title="លុបប្រភេទ"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
    
    // --- Main Layout ---
    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
            {error && <ErrorMessage message={error} onClose={() => setError(null)} />}

            {/* Sidebar Navigation */}
            <aside className="md:w-64 bg-white shadow-xl p-4 md:p-6 md:min-h-screen border-r fixed bottom-0 md:static w-full z-10">
                <div className="hidden md:block mb-8">
                    <h1 className="text-2xl font-extrabold text-indigo-700">MoneyTrack</h1>
                    <p className="text-sm text-gray-500">គ្រប់គ្រងហិរញ្ញវត្ថុ</p>
                </div>
                
                <nav className="flex md:flex-col justify-around md:space-y-2">
                    <NavItem 
                        icon={Home} 
                        label="ទំព័រដើម" 
                        target="dashboard" 
                        currentView={currentView} 
                        setCurrentView={setCurrentView} 
                    />
                    <NavItem 
                        icon={TrendingUp} 
                        label="បញ្ចូលថ្មី" 
                        target="add" 
                        currentView={currentView} 
                        setCurrentView={setCurrentView} 
                    />
                    <NavItem 
                        icon={BarChart} 
                        label="របាយការណ៍" 
                        target="reports" 
                        currentView={currentView} 
                        setCurrentView={setCurrentView} 
                    />
                     <NavItem 
                        icon={Settings} 
                        label="ការកំណត់" 
                        target="settings" 
                        currentView={currentView} 
                        setCurrentView={setCurrentView} 
                    />
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 mb-20 md:mb-0 max-w-4xl mx-auto w-full">
                {currentView === 'dashboard' && <DashboardView />}
                
                {currentView === 'add' && 
                    <AddTransactionView 
                        allCategories={allCategories}
                        formType={formType}
                        setFormType={setFormType}
                        setFormCategory={setFormCategory}
                        setFormAmount={setFormAmount}
                        setFormDescription={setFormDescription}
                        formCategory={formCategory}
                        formAmount={formAmount}
                        formDescription={formDescription}
                        handleAddTransaction={handleAddTransaction}
                        setCurrentView={setCurrentView}
                        currencySymbol={currencySymbol} 
                    />
                }
                
                {currentView === 'settings' && <SettingsView />}
                {currentView === 'reports' && (
                    <div className='p-6 bg-white rounded-xl shadow-lg'>
                        <Header title="របាយការណ៍ (Reports)" />
                        <p className='text-gray-600'>ទំព័ររបាយការណ៍កំពុងត្រូវបានអភិវឌ្ឍ...</p>
                    </div>
                )}
            </main>
        </div>
    );
};

// ------------------------------------------------------------------
// --- 5. MAIN APP COMPONENT ---
// ------------------------------------------------------------------

const App = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);
    
    const handleSignOut = async () => {
        setError(null);
        setSuccessMessage(null);
        try {
            await signOut(auth);
            setSuccessMessage("ចេញដោយជោគជ័យ! (Signed out successfully!)");
        } catch (e) {
            console.error("Sign out error:", e);
            setError("បរាជ័យក្នុងការចេញពីគណនី។");
        }
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <Loader className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="ml-3 text-gray-700">កំពុងផ្ទុកការអនុញ្ញាត...</p>
            </div>
        );
    }

    return (
        <>
            {error && <ErrorMessage message={error} onClose={() => setError(null)} />}
            {successMessage && (
                <div className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-xl flex items-center z-50 transition-opacity duration-300">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    {successMessage}
                    <button onClick={() => setSuccessMessage(null)} className="ml-4 text-white font-bold">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
            
            {currentUser ? (
                <FinanceDashboard 
                    currentUser={currentUser} 
                    handleSignOut={handleSignOut}
                />
            ) : (
                <AuthView setError={setError} setSuccessMessage={setSuccessMessage}/>
            )}
        </>
    );
};

export default App;