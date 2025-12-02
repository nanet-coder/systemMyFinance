import React, { useState, useEffect, useCallback, useMemo } from 'react'; 
import { initializeApp } from 'firebase/app';
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
import { 
    LogIn, UserPlus, Home, TrendingUp, Settings, BarChart, X, AlertTriangle, Loader, CheckCircle, User, PieChart, Filter, Calendar 
} from 'lucide-react'; 

// Set Firebase Log Level to debug for development purposes
try {
    // setLogLevel('Debug'); // Disable for production
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
let googleProvider;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider(); 
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

// Default categories (Khmer/English)
const defaultCategories = {
    income: [
        { name: 'ប្រាក់ខែ (Salary)', color: 'bg-green-500/10 text-green-700', isDefault: true, type: 'income' },
        { name: 'ជំនួញ (Business)', color: 'bg-emerald-500/10 text-emerald-700', isDefault: true, type: 'income' },
        { name: 'ផ្សេងៗ (Other)', color: 'bg-lime-500/10 text-lime-700', isDefault: true, type: 'income' }
    ],
    expense: [
        { name: 'អាហារ (Food)', color: 'bg-red-500/10 text-red-700', isDefault: true, type: 'expense' },
        { name: 'ជួលផ្ទះ (Rent)', color: 'bg-orange-500/10 text-orange-700', isDefault: true, type: 'expense' },
        { name: 'ដឹកជញ្ជូន (Transport)', color: 'bg-yellow-500/10 text-yellow-700', isDefault: true, type: 'expense' },
        { name: 'ផ្សេងៗ (Other)', color: 'bg-pink-500/10 text-pink-700', isDefault: true, type: 'expense' }
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
// --- REPORTS VIEW COMPONENT (Includes Date Filters) ---
// ------------------------------------------------------------------

const ReportsView = ({ transactions, allCategories, formatCurrency }) => {
    
    // 1. Filter States
    const allYears = useMemo(() => {
        if (transactions.length === 0) return [];
        const years = new Set(transactions.map(t => t.date.getFullYear().toString()));
        return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    }, [transactions]);
    
    const [filterYear, setFilterYear] = useState('all');
    const [filterMonth, setFilterMonth] = useState('all'); 


    // 2. Filtered Transactions (Memoized)
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const tYear = t.date.getFullYear().toString();
            const tMonth = (t.date.getMonth() + 1).toString();

            const yearMatch = filterYear === 'all' || tYear === filterYear;
            const monthMatch = filterMonth === 'all' || tMonth === filterMonth;

            return yearMatch && monthMatch;
        });
    }, [transactions, filterYear, filterMonth]);


    // 3. Calculate Summary based on Filtered Transactions
    const categorySummary = useMemo(() => {
        const summary = {};
        
        // Initialize all known categories
        [...allCategories.income, ...allCategories.expense].forEach(cat => {
            summary[cat.name] = { income: 0, expense: 0, color: cat.color, type: cat.type };
        });

        // Aggregate filtered transactions
        filteredTransactions.forEach(t => {
            const catName = t.category;
            if (summary[catName]) {
                if (t.type === 'income') {
                    summary[catName].income += t.amount;
                } else if (t.type === 'expense') {
                    summary[catName].expense += t.amount;
                }
            } else {
                // Handle categories not in default/user lists (unlikely)
                summary[catName] = { 
                    income: t.type === 'income' ? t.amount : 0, 
                    expense: t.type === 'expense' ? t.amount : 0,
                    color: t.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
                    type: t.type
                };
            }
        });

        return summary;
    }, [filteredTransactions, allCategories]);

    const incomeCategories = Object.entries(categorySummary)
        .filter(([name, data]) => data.type === 'income' && data.income > 0)
        .sort((a, b) => b[1].income - a[1].income);
        
    const expenseCategories = Object.entries(categorySummary)
        .filter(([name, data]) => data.type === 'expense' && data.expense > 0)
        .sort((a, b) => b[1].expense - a[1].expense);

    return (
        <div className="space-y-8">
            <Header title="របាយការណ៍សង្ខេប (Financial Reports)" />

            {/* --- Filter Controls for Report --- */}
            <div className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-indigo-400">
                <h2 className="text-lg font-semibold mb-3 text-gray-700 flex items-center"><Filter className='w-5 h-5 mr-2 text-indigo-500'/> តម្រងរបាយការណ៍</h2>
                <div className="grid grid-cols-2 gap-4">
                    {/* Year Filter */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">ឆ្នាំ (Year)</label>
                        <select
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="all">ឆ្នាំទាំងអស់</option>
                            {allYears.map(year => (
                                <option key={year} value={year}>
                                    ឆ្នាំ {year}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Month Filter */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">ខែ (Month)</label>
                        <select
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        >
                            <option value="all">ខែទាំងអស់</option>
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

            {filteredTransactions.length === 0 ? (
                <div className="p-8 bg-white rounded-xl shadow-lg text-center border border-dashed text-gray-500">
                    <PieChart className="w-10 h-10 mx-auto mb-3 text-red-500"/>
                    <p>មិនមានទិន្នន័យប្រតិបត្តិការត្រូវគ្នាជាមួយនឹងតម្រងទេ។</p>
                    <p className='mt-1 text-sm'>សូមកែតម្រូវ $Filter$ ខែ/ឆ្នាំរបស់អ្នក។</p>
                </div>
            ) : (
                <>
                    <p className='text-sm text-gray-600 font-medium'>
                        បង្ហាញរបាយការណ៍សម្រាប់ប្រតិបត្តិការចំនួន **{filteredTransactions.length}** ដែលត្រូវបានរកឃើញសម្រាប់ {filterMonth === 'all' ? 'គ្រប់ខែ' : `ខែ ${filterMonth}`} {filterYear === 'all' ? 'គ្រប់ឆ្នាំ' : `ឆ្នាំ ${filterYear}`}.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Income Summary */}
                        <ReportSection 
                            title="ចំណូលតាមប្រភេទ (Income by Category)" 
                            data={incomeCategories} 
                            type="income"
                            formatCurrency={formatCurrency}
                        />

                        {/* Expense Summary */}
                        <ReportSection 
                            title="ចំណាយតាមប្រភេទ (Expense by Category)" 
                            data={expenseCategories} 
                            type="expense"
                            formatCurrency={formatCurrency}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

// Report Helper Component (Remains the same)
const ReportSection = ({ title, data, type, formatCurrency }) => {
    const total = data.reduce((sum, [name, d]) => sum + (type === 'income' ? d.income : d.expense), 0);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border-t-4" style={{borderColor: type === 'income' ? '#10B981' : '#EF4444'}}>
            <h2 className="text-xl font-semibold mb-4 text-gray-800">{title}</h2>
            {data.length === 0 ? (
                <p className="text-gray-500 italic">គ្មានទិន្នន័យចំណូល/ចំណាយសម្រាប់ប្រភេទនេះទេ។</p>
            ) : (
                <ul className="space-y-4">
                    {data.map(([name, d]) => {
                        const amount = type === 'income' ? d.income : d.expense;
                        const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
                        const colorClass = type === 'income' ? 'bg-green-500' : 'bg-red-500';
                        
                        return (
                            <li key={name} className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700 text-sm">{name}</span>
                                    <span className={`font-bold text-sm ${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(amount)} ({percentage}%)
                                    </span>
                                </div>
                                {/* Progress Bar */}
                                <div className="h-2 bg-gray-200 rounded-full">
                                    <div 
                                        className={`h-2 rounded-full ${colorClass}`} 
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            <div className='mt-4 pt-3 border-t border-gray-200 flex justify-between font-bold'>
                 <span>សរុប (Total)</span>
                 <span className={`${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(total)}</span>
            </div>
        </div>
    );
};


// ------------------------------------------------------------------
// --- ADD TRANSACTION CONTAINER (Holds all Form State) ---
// ------------------------------------------------------------------

const AddTransactionContainer = ({ 
    allCategories, 
    currencySymbol, 
    setCurrentView,
    handleAddTransaction
}) => {
    // 💡 Form States
    const [formType, setFormType] = useState('expense');
    const initialExpenseCategoryName = useMemo(() => allCategories.expense[0]?.name || '', [allCategories.expense]);
    const [formAmount, setFormAmount] = useState('');
    const [formCategory, setFormCategory] = useState(initialExpenseCategoryName);
    const [formDescription, setFormDescription] = useState('');
    // 💡 ADDED: Date Input State
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]); // Default to current day in 'YYYY-MM-DD' format

    // Update form category when type changes 
    useEffect(() => {
        const categories = formType === 'expense' ? allCategories.expense : allCategories.income;
        // Only update if the current selected category is not valid for the new type
        if (!categories.some(c => c.name === formCategory)) {
            setFormCategory(categories[0]?.name || '');
        }
    }, [formType, allCategories.expense, allCategories.income, formCategory]);

    // 💡 Wrapper function for the submit handler
    const handleSubmitWrapper = useCallback((e) => {
        e.preventDefault();
        
        // Data to be passed to the parent handler
        const formData = {
            type: formType,
            amount: formAmount,
            category: formCategory,
            description: formDescription,
            date: formDate // 💡 PASS DATE
        };
        
        // Define reset callback
        const resetFormCallback = () => {
            setFormAmount('');
            setFormDescription('');
            setFormDate(new Date().toISOString().split('T')[0]); // Reset date to current day
            setCurrentView('dashboard');
        };

        // Call parent handler with data and reset callback
        handleAddTransaction(formData, resetFormCallback);

    }, [formType, formAmount, formCategory, formDescription, formDate, handleAddTransaction, setCurrentView]);

    // ប្រើ React.memo លើ UI Component
    return (
        <AddTransactionUI 
            allCategories={allCategories}
            currencySymbol={currencySymbol}
            setCurrentView={setCurrentView}
            
            formType={formType}
            setFormType={setFormType}
            formAmount={formAmount}
            setFormAmount={setFormAmount}
            formCategory={formCategory}
            setFormCategory={setFormCategory}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            
            // 💡 PASS DATE STATES
            formDate={formDate}
            setFormDate={setFormDate}
            
            handleAddTransaction={handleSubmitWrapper} // ប្រើ wrapper function
        />
    )
}

// ------------------------------------------------------------------
// --- ISOLATED ADD TRANSACTION UI COMPONENT (Pure UI) ---
// ------------------------------------------------------------------

const AddTransactionUI = React.memo(({ 
    allCategories, formType, setFormType, setFormCategory, setFormAmount, 
    setFormDescription, formCategory, formAmount, formDescription, 
    handleAddTransaction, setCurrentView, currencySymbol, 
    // 💡 RECEIVE DATE STATES
    formDate, setFormDate
}) => {
    
    // Handlers ទាំងនេះឥឡូវប្រើ set state ដែលមាននៅក្នុង Container
    const handleAmountChange = useCallback((e) => {
        setFormAmount(e.target.value); 
    }, [setFormAmount]); 

    const handleCategoryChange = useCallback((e) => {
        setFormCategory(e.target.value);
    }, [setFormCategory]);

    const handleDescriptionChange = useCallback((e) => {
        setFormDescription(e.target.value);
    }, [setFormDescription]);
    
    // 💡 NEW: Date Change Handler
    const handleDateChange = useCallback((e) => {
        setFormDate(e.target.value);
    }, [setFormDate]);


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

            {/* 💡 NEW: Date Input */}
            <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                    កាលបរិច្ឆេទ (Date)<span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <input
                        id="date"
                        type="date"
                        required
                        value={formDate}
                        onChange={handleDateChange} 
                        className="mt-1 block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white appearance-none"
                    />
                    <Calendar className='absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none'/>
                </div>
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
// --- DASHBOARD VIEW (EXTRACTED FOR CLARITY & PROP FIX) ---
// ------------------------------------------------------------------

const DashboardView = ({
    localError, handleDeleteTransaction, filteredTransactions, isLoading, formatCurrency, 
    getCategoryColor, currentBalance, totalIncome, totalExpense, setCurrentView,
    searchTerm, setSearchTerm, filterType, setFilterType, filterMonth, setFilterMonth,
    filterYear, setFilterYear, allYears // Props ទាំងអស់ត្រូវបានបញ្ជូន និងកំណត់ត្រឹមត្រូវ
}) => (
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
        
        {/* --- Filter Controls (Uses Filter Props) --- */}
        <div className="bg-white p-4 rounded-xl shadow-lg">
            <h2 className="text-lg font-semibold mb-3 text-gray-700">តម្រង (Filters)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                
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
                        <option value="all">ប្រភេទទាំងអស់</option>
                        <option value="income">ចំណូល</option>
                        <option value="expense">ចំណាយ</option>
                    </select>
                </div>

                {/* Month Filter */}
                <div>
                    <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                        <option value="all">ខែទាំងអស់</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <option key={month} value={month.toString()}>
                                ខែ {month} / {new Date(0, month - 1).toLocaleString('en-US', { month: 'short' })}
                            </option>
                        ))}
                    </select>
                </div>
                
                {/* Year Filter */}
                <div>
                     <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                        <option value="all">ឆ្នាំទាំងអស់</option>
                        {allYears.map(year => (
                            <option key={year} value={year}>
                                ឆ្នាំ {year}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>

        {/* Recent Transactions List (Includes Delete Button) */}
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
                         <li key={t.id} className="flex justify-between items-center border-b pb-3 last:border-b-0 last:pb-0 group hover:bg-gray-50 p-2 -mx-2 rounded-lg transition duration-150">
                            <div className="flex items-center space-x-3">
                                <span className={`p-2 rounded-lg ${getCategoryColor(t.category, t.type)} text-xs font-semibold`}>
                                    {t.type === 'income' ? 'I' : 'E'}
                                </span>
                                <div>
                                    <p className="font-medium text-gray-800 text-sm">{t.category}</p>
                                    <p className="text-xs text-gray-500">{t.description || 'N/A'}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                                <div className="text-right">
                                    <p className={`font-semibold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {t.date.toLocaleDateString('km-KH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                
                                {/* Delete Button */}
                                <button
                                    onClick={() => handleDeleteTransaction(t.id)}
                                    className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition duration-150 p-1"
                                    title="លុបប្រតិបត្តិការ"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        {/* 💡 FIX: ប្រើ prop localError */}
        {localError && <p className="text-red-500 text-sm text-center mt-4">Dashboard Error: {localError}</p>}
    </div>
);


// ------------------------------------------------------------------
// --- 4. FINANCE DASHBOARD COMPONENT (Authenticated View) ---
// ------------------------------------------------------------------

const FinanceDashboard = ({ currentUser, handleSignOut, setSuccessMessage, setError }) => {
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
    // 💡 FIX: ប្រើ setLocalError ជា State ក្នុងស្រុកសម្រាប់ Dashboard
    const [localError, setLocalError] = useState(null); 
    const [currentView, setCurrentView] = useState('dashboard'); 
    
    // Category States
    const [userCategories, setUserCategories] = useState({ income: [], expense: [] });
    
    // 💡 useMemo សម្រាប់ allCategories
    const allCategories = useMemo(() => {
        return {
            income: [...defaultCategories.income, ...userCategories.income],
            expense: [...defaultCategories.expense, ...userCategories.expense],
        };
    }, [userCategories.income, userCategories.expense]);


    // --- Filter States (for Dashboard) ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMonth, setFilterMonth] = useState('all');
    const [filterType, setFilterType] = useState('all');
    // 💡 Filter Year State
    const [filterYear, setFilterYear] = useState('all');
    
    // 💡 useMemo: Calculate all available years
    const allYears = useMemo(() => {
        if (transactions.length === 0) return [];
        // Get unique years, convert to string, and sort descending
        const years = new Set(transactions.map(t => t.date.getFullYear().toString()));
        return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    }, [transactions]);


    // ... (Data Listeners remain the same) ...
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
                    // ត្រូវប្រាកដថា date គឺជា object Date សម្រាប់ operations ដូចជា getFullYear, getMonth
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
            setLocalError(null); // Clear local error on successful fetch

        }, (e) => {
            console.error("Error fetching transactions:", e);
            setLocalError("បរាជ័យក្នុងការផ្ទុកប្រតិបត្តិការ។ (Failed to load transactions).");
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
    const handleAddTransaction = useCallback(async (formData, resetFormCallback) => {
        
        if (!db || !userId) {
            setError("Firebase or User ID not available.");
            return;
        }

        const amount = parseFloat(formData.amount);
        if (isNaN(amount) || amount <= 0 || !formData.category) {
            setError("សូមបញ្ចូលចំនួនទឹកប្រាក់ត្រឹមត្រូវ និងប្រភេទចំណាត់ថ្នាក់។");
            return;
        }
        
        // 💡 UPDATED: Use provided date or fallback to serverTimestamp (though formDate should always be set)
        const dateToUse = formData.date ? Timestamp.fromDate(new Date(formData.date)) : serverTimestamp();

        const newTransaction = {
            type: formData.type, 
            amount: amount,
            category: formData.category,
            description: formData.description || '',
            date: dateToUse,
            userId: userId,
        };

        try {
            const path = `artifacts/${appId}/users/${userId}/transactions`;
            await addDoc(collection(db, path), newTransaction);
            setSuccessMessage("ប្រតិបត្តិការត្រូវបានបញ្ចូលដោយជោគជ័យ។");
            resetFormCallback();
            
        } catch (e) {
            console.error("Error adding document: ", e);
            setError("បរាជ័យក្នុងការបញ្ចូលទិន្នន័យ។ (Failed to add transaction).");
        }
    }, [db, userId, setError, setSuccessMessage]);
    
    // 💡 NEW: DELETE TRANSACTION FUNCTION
    const handleDeleteTransaction = useCallback(async (transactionId) => {
        if (!db || !userId || !transactionId) return;

        if (!window.confirm("តើអ្នកពិតជាចង់លុបប្រតិបត្តិការនេះមែនទេ? (This action cannot be undone)")) {
            return;
        }

        try {
            const path = `artifacts/${appId}/users/${userId}/transactions/${transactionId}`;
            await deleteDoc(doc(db, path));
            setSuccessMessage("ប្រតិបត្តិការត្រូវបានលុបដោយជោគជ័យ។");
        } catch (e) {
            console.error("Error deleting transaction:", e);
            setError("បរាជ័យក្នុងការលុបប្រតិបត្តិការ។ (Failed to delete transaction).");
        }
    }, [db, userId, setError, setSuccessMessage]);


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
            setSuccessMessage("ប្រភេទថ្មីត្រូវបានបន្ថែម។");
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
            setSuccessMessage("ប្រភេទត្រូវបានលុបដោយជោគជ័យ។");
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
            setSuccessMessage(`រូបិយប័ណ្ណត្រូវបានកំណត់ទៅជា ${selectedCurrency.name}។`);

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
    
    const getFilteredTransactions = useCallback(() => {
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
        
        // 💡 NEW FILTER LOGIC: Filter by Year
        if (filterYear !== 'all') {
            filtered = filtered.filter(t => {
                if (t.date instanceof Date) {
                    return t.date.getFullYear().toString() === filterYear;
                }
                return false;
            });
        }
        
        return filtered;
    }, [transactions, searchTerm, filterType, filterMonth, filterYear]); // Add filterYear to dependency array

    const filteredTransactions = getFilteredTransactions();
    
    // --- Settings View (Remains the same structure) ---
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
            {/* Error is now handled by App component, but we keep the local state for specific errors */}
            {/* 💡 FIX: localError ត្រូវបានប្រើនៅក្នុង DashboardView ឥឡូវនេះ */}
            {localError && <ErrorMessage message={localError} onClose={() => setLocalError(null)} />}

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
                {currentView === 'dashboard' && 
                    // 💡 FIX: បញ្ជូន Props ទាំងអស់ទៅកាន់ DashboardView
                    <DashboardView 
                        localError={localError}
                        handleDeleteTransaction={handleDeleteTransaction}
                        filteredTransactions={filteredTransactions}
                        isLoading={isLoading}
                        formatCurrency={formatCurrency}
                        getCategoryColor={getCategoryColor}
                        currentBalance={currentBalance}
                        totalIncome={totalIncome}
                        totalExpense={totalExpense}
                        setCurrentView={setCurrentView}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        filterType={filterType}
                        setFilterType={setFilterType}
                        filterMonth={filterMonth}
                        setFilterMonth={setFilterMonth}
                        filterYear={filterYear}
                        setFilterYear={setFilterYear}
                        allYears={allYears}
                    />
                }
                
                {currentView === 'add' && 
                    <AddTransactionContainer 
                        allCategories={allCategories}
                        currencySymbol={currencySymbol}
                        setCurrentView={setCurrentView}
                        handleAddTransaction={handleAddTransaction} 
                    />
                }
                
                {currentView === 'reports' && (
                    <ReportsView
                        transactions={transactions}
                        allCategories={allCategories}
                        formatCurrency={formatCurrency}
                    />
                )}
                
                {currentView === 'settings' && <SettingsView />}
            </main>
        </div>
    );
};

// ------------------------------------------------------------------
// --- 5. MAIN APP COMPONENT ---
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
                            id="auth-email" 
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
                            id="auth-password" 
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
                        <svg className="w-5 h-5 mr-2 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.4H24v7.7h11.7c-.5 3.3-2.5 6.1-5.6 7.9l7.7 6.1c4.5-4.2 7.1-10.4 7.1-17.7 0-1.1-.1-2.2-.3-3.3z"/><path fill="#FF3D00" d="M24 8.7c5.2 0 9.9 1.8 13.5 4.9l-7.7 6.1c-2.1-1.3-4.7-2-7.8-2-6 0-11.1 4-13 9.4l-7.9-6.1c3.8-7.7 11.6-13.3 20.9-13.3z"/><path fill="#4CAF50" d="M11 28.5c-.5 1.5-.8 3.1-.8 4.8 0 1.7.3 3.3.8 4.8l7.9 6.1c1.3-3.6 2-7.7 2-12.7 0-5.1-.7-9.3-2-12.7l-7.9 6.1z"/><path fill="#1976D2" d="M24 44c5.1 0 9.8-1.7 13.1-4.7l-7.7-6.1c-2 1.2-4.5 1.8-7.7 1.8-6.1 0-11.3-4-13.2-9.4l-7.9 6.1c3.8 7.7 11.6 13.3 20.9 13.3z"/></svg>
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
                    setError={setError} // Pass down global error handler
                    setSuccessMessage={setSuccessMessage} // Pass down global success handler
                />
            ) : (
                <AuthView setError={setError} setSuccessMessage={setSuccessMessage}/>
            )}
        </>
    );
};

export default App;