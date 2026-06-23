/**
 * functions-panel.js — "Using Functions" side-drawer for Zenith C++
 *
 * Features:
 *   - 60+ built-in C++ function templates across 9 categories
 *   - Smart "Suggested" tab based on #include directives in code
 *   - Auto-add required #include headers on insert
 *   - User-defined custom functions (persisted in localStorage)
 *   - Live search/filter across all functions
 */

'use strict';

// ── localStorage key for user-defined functions ──────────────────────────────
const LS_USER_FN_KEY = 'zenith-user-functions-v1';

// ── Include → Category mapping for smart suggestions ─────────────────────────
const INCLUDE_CATEGORY_MAP = {
  'iostream':       ['Vector', 'Linked List', 'Bit Ops'],
  'cmath':          ['Math'],
  'math.h':         ['Math'],
  'cstdlib':        ['Math'],
  'cstdio':         ['Math'],
  'string':         ['String'],
  'cstring':        ['String'],
  'cctype':         ['String'],
  'sstream':        ['String'],
  'vector':         ['Vector', 'Sorting', 'Searching', 'Graph', 'Dynamic Programming'],
  'algorithm':      ['Sorting', 'Searching'],
  'list':           ['Linked List'],
  'queue':          ['Graph'],
  'stack':          ['Graph'],
  'map':            ['Vector'],
  'unordered_map':  ['Vector'],
  'numeric':        ['Vector', 'Math'],
  'climits':        ['Math'],
  'utility':        ['Vector'],
  'bits/stdc++.h':  null  // null = show all
};

// ── Full Function Library ─────────────────────────────────────────────────────
const ZENITH_FUNCTION_LIBRARY = [

  // ═══════════════════════ MATH ════════════════════════════════════════════
  {
    id: 'math-gcd',
    category: 'Math',
    name: 'gcd',
    signature: 'int gcd(int a, int b)',
    description: 'Greatest common divisor — Euclidean algorithm',
    includes: [],
    code:
`int gcd(int a, int b) {
    while (b != 0) {
        int t = b;
        b = a % b;
        a = t;
    }
    return a;
}`
  },
  {
    id: 'math-lcm',
    category: 'Math',
    name: 'lcm',
    signature: 'long long lcm(long long a, long long b)',
    description: 'Least common multiple (safe from overflow)',
    includes: [],
    code:
`long long gcd(long long a, long long b) {
    return b == 0 ? a : gcd(b, a % b);
}

long long lcm(long long a, long long b) {
    return (a / gcd(a, b)) * b;
}`
  },
  {
    id: 'math-isprime',
    category: 'Math',
    name: 'isPrime',
    signature: 'bool isPrime(int n)',
    description: 'Primality test — O(√n)',
    includes: ['cmath'],
    code:
`bool isPrime(int n) {
    if (n < 2) return false;
    if (n == 2) return true;
    if (n % 2 == 0) return false;
    for (int i = 3; i <= (int)sqrt((double)n); i += 2)
        if (n % i == 0) return false;
    return true;
}`
  },
  {
    id: 'math-sieve',
    category: 'Math',
    name: 'sieveOfEratosthenes',
    signature: 'vector<int> sieve(int n)',
    description: 'Returns all primes up to n using Sieve of Eratosthenes',
    includes: ['vector'],
    code:
`vector<int> sieveOfEratosthenes(int n) {
    vector<bool> is_prime(n + 1, true);
    is_prime[0] = is_prime[1] = false;
    for (int i = 2; (long long)i * i <= n; i++)
        if (is_prime[i])
            for (int j = i * i; j <= n; j += i)
                is_prime[j] = false;
    vector<int> primes;
    for (int i = 2; i <= n; i++)
        if (is_prime[i]) primes.push_back(i);
    return primes;
}`
  },
  {
    id: 'math-factorial',
    category: 'Math',
    name: 'factorial',
    signature: 'long long factorial(int n)',
    description: 'Factorial — iterative, accurate up to n = 20',
    includes: [],
    code:
`long long factorial(int n) {
    long long result = 1;
    for (int i = 2; i <= n; i++)
        result *= i;
    return result;
}`
  },
  {
    id: 'math-fibonacci',
    category: 'Math',
    name: 'fibonacci',
    signature: 'long long fibonacci(int n)',
    description: 'nth Fibonacci number (0-indexed, iterative)',
    includes: [],
    code:
`long long fibonacci(int n) {
    if (n <= 1) return n;
    long long a = 0, b = 1;
    for (int i = 2; i <= n; i++) {
        long long c = a + b;
        a = b;
        b = c;
    }
    return b;
}`
  },
  {
    id: 'math-power',
    category: 'Math',
    name: 'power',
    signature: 'long long power(long long base, int exp)',
    description: 'Fast integer exponentiation — O(log n)',
    includes: [],
    code:
`long long power(long long base, int exp) {
    long long result = 1;
    while (exp > 0) {
        if (exp & 1) result *= base;
        base *= base;
        exp >>= 1;
    }
    return result;
}`
  },
  {
    id: 'math-powermod',
    category: 'Math',
    name: 'powerMod',
    signature: 'long long powerMod(long long b, long long e, long long m)',
    description: 'Modular exponentiation: (b^e) % m',
    includes: [],
    code:
`long long powerMod(long long b, long long e, long long m) {
    long long result = 1;
    b %= m;
    while (e > 0) {
        if (e & 1) result = result * b % m;
        b = b * b % m;
        e >>= 1;
    }
    return result;
}`
  },
  {
    id: 'math-ncr',
    category: 'Math',
    name: 'nCr',
    signature: 'long long nCr(int n, int r)',
    description: 'Binomial coefficient C(n, r) without overflow for moderate n',
    includes: [],
    code:
`long long nCr(int n, int r) {
    if (r > n) return 0;
    if (r > n - r) r = n - r;
    long long result = 1;
    for (int i = 0; i < r; i++) {
        result *= (n - i);
        result /= (i + 1);
    }
    return result;
}`
  },
  {
    id: 'math-digitsum',
    category: 'Math',
    name: 'digitSum',
    signature: 'int digitSum(int n)',
    description: 'Sum of all digits of an integer',
    includes: ['cstdlib'],
    code:
`int digitSum(int n) {
    n = abs(n);
    int sum = 0;
    while (n > 0) { sum += n % 10; n /= 10; }
    return sum;
}`
  },
  {
    id: 'math-reversenum',
    category: 'Math',
    name: 'reverseNumber',
    signature: 'long long reverseNumber(long long n)',
    description: 'Reverse the digits of an integer',
    includes: ['cstdlib'],
    code:
`long long reverseNumber(long long n) {
    bool neg = n < 0;
    n = llabs(n);
    long long rev = 0;
    while (n > 0) { rev = rev * 10 + n % 10; n /= 10; }
    return neg ? -rev : rev;
}`
  },
  {
    id: 'math-armstrong',
    category: 'Math',
    name: 'isArmstrong',
    signature: 'bool isArmstrong(int n)',
    description: 'Check if n is an Armstrong (narcissistic) number',
    includes: ['cmath'],
    code:
`bool isArmstrong(int n) {
    int original = n, sum = 0, digits = 0;
    int temp = n;
    while (temp > 0) { digits++; temp /= 10; }
    temp = n;
    while (temp > 0) {
        int d = temp % 10;
        sum += (int)round(pow(d, digits));
        temp /= 10;
    }
    return sum == original;
}`
  },
  {
    id: 'math-perfectnum',
    category: 'Math',
    name: 'isPerfect',
    signature: 'bool isPerfect(int n)',
    description: 'Check if n is a perfect number',
    includes: [],
    code:
`bool isPerfect(int n) {
    if (n <= 1) return false;
    int sum = 1;
    for (int i = 2; (long long)i * i <= n; i++) {
        if (n % i == 0) {
            sum += i;
            if (i != n / i) sum += n / i;
        }
    }
    return sum == n;
}`
  },
  {
    id: 'math-primefactors',
    category: 'Math',
    name: 'primeFactors',
    signature: 'vector<int> primeFactors(int n)',
    description: 'Returns all prime factors of n (with repetition)',
    includes: ['vector'],
    code:
`vector<int> primeFactors(int n) {
    vector<int> factors;
    for (int i = 2; (long long)i * i <= n; i++) {
        while (n % i == 0) {
            factors.push_back(i);
            n /= i;
        }
    }
    if (n > 1) factors.push_back(n);
    return factors;
}`
  },
  {
    id: 'math-clamp',
    category: 'Math',
    name: 'clamp',
    signature: 'int clamp(int val, int lo, int hi)',
    description: 'Clamp value within [lo, hi]',
    includes: [],
    code:
`int clamp(int val, int lo, int hi) {
    return (val < lo) ? lo : (val > hi) ? hi : val;
}`
  },
  {
    id: 'math-abs',
    category: 'Math',
    name: 'absVal',
    signature: 'template<typename T> T absVal(T x)',
    description: 'Absolute value — generic template version',
    includes: [],
    code:
`template<typename T>
T absVal(T x) {
    return (x < 0) ? -x : x;
}`
  },
  {
    id: 'math-divisors',
    category: 'Math',
    name: 'getDivisors',
    signature: 'vector<int> getDivisors(int n)',
    description: 'Returns all divisors of n in sorted order',
    includes: ['vector', 'algorithm'],
    code:
`vector<int> getDivisors(int n) {
    vector<int> divs;
    for (int i = 1; (long long)i * i <= n; i++) {
        if (n % i == 0) {
            divs.push_back(i);
            if (i != n / i) divs.push_back(n / i);
        }
    }
    sort(divs.begin(), divs.end());
    return divs;
}`
  },
  {
    id: 'math-log2ceil',
    category: 'Math',
    name: 'log2Ceil',
    signature: 'int log2Ceil(int n)',
    description: 'Ceiling of log₂(n) — useful for segment trees',
    includes: [],
    code:
`int log2Ceil(int n) {
    if (n <= 1) return 0;
    int result = 0;
    while ((1 << result) < n) result++;
    return result;
}`
  },

  // ═══════════════════════ STRING ══════════════════════════════════════════
  {
    id: 'str-reverse',
    category: 'String',
    name: 'reverseString',
    signature: 'string reverseString(string s)',
    description: 'Reverse a string in-place',
    includes: ['string'],
    code:
`string reverseString(string s) {
    int l = 0, r = (int)s.size() - 1;
    while (l < r) swap(s[l++], s[r--]);
    return s;
}`
  },
  {
    id: 'str-palindrome',
    category: 'String',
    name: 'isPalindrome',
    signature: 'bool isPalindrome(const string& s)',
    description: 'Check palindrome (case-insensitive, alphanumeric only)',
    includes: ['string', 'cctype'],
    code:
`bool isPalindrome(const string& s) {
    int l = 0, r = (int)s.size() - 1;
    while (l < r) {
        while (l < r && !isalnum(s[l])) l++;
        while (l < r && !isalnum(s[r])) r--;
        if (tolower(s[l]) != tolower(s[r])) return false;
        l++; r--;
    }
    return true;
}`
  },
  {
    id: 'str-toupper',
    category: 'String',
    name: 'toUpperCase',
    signature: 'string toUpperCase(string s)',
    description: 'Convert entire string to uppercase',
    includes: ['string', 'cctype'],
    code:
`string toUpperCase(string s) {
    for (char& c : s) c = (char)toupper((unsigned char)c);
    return s;
}`
  },
  {
    id: 'str-tolower',
    category: 'String',
    name: 'toLowerCase',
    signature: 'string toLowerCase(string s)',
    description: 'Convert entire string to lowercase',
    includes: ['string', 'cctype'],
    code:
`string toLowerCase(string s) {
    for (char& c : s) c = (char)tolower((unsigned char)c);
    return s;
}`
  },
  {
    id: 'str-trim',
    category: 'String',
    name: 'trim',
    signature: 'string trim(const string& s)',
    description: 'Remove leading and trailing whitespace',
    includes: ['string'],
    code:
`string trim(const string& s) {
    size_t start = s.find_first_not_of(" \\t\\r\\n");
    if (start == string::npos) return "";
    size_t end = s.find_last_not_of(" \\t\\r\\n");
    return s.substr(start, end - start + 1);
}`
  },
  {
    id: 'str-split',
    category: 'String',
    name: 'split',
    signature: 'vector<string> split(const string& s, char delim)',
    description: 'Split string by delimiter into a vector',
    includes: ['string', 'vector', 'sstream'],
    code:
`vector<string> split(const string& s, char delim) {
    vector<string> tokens;
    string token;
    istringstream iss(s);
    while (getline(iss, token, delim))
        if (!token.empty()) tokens.push_back(token);
    return tokens;
}`
  },
  {
    id: 'str-join',
    category: 'String',
    name: 'join',
    signature: 'string join(const vector<string>& v, const string& sep)',
    description: 'Join vector of strings with a separator',
    includes: ['string', 'vector'],
    code:
`string join(const vector<string>& v, const string& sep) {
    string result;
    for (size_t i = 0; i < v.size(); i++) {
        if (i > 0) result += sep;
        result += v[i];
    }
    return result;
}`
  },
  {
    id: 'str-replaceall',
    category: 'String',
    name: 'replaceAll',
    signature: 'string replaceAll(string s, const string& from, const string& to)',
    description: 'Replace all non-overlapping occurrences',
    includes: ['string'],
    code:
`string replaceAll(string s, const string& from, const string& to) {
    if (from.empty()) return s;
    size_t pos = 0;
    while ((pos = s.find(from, pos)) != string::npos) {
        s.replace(pos, from.size(), to);
        pos += to.size();
    }
    return s;
}`
  },
  {
    id: 'str-countoccur',
    category: 'String',
    name: 'countOccurrences',
    signature: 'int countOccurrences(const string& s, const string& sub)',
    description: 'Count non-overlapping occurrences of substring',
    includes: ['string'],
    code:
`int countOccurrences(const string& s, const string& sub) {
    int count = 0;
    size_t pos = 0;
    while ((pos = s.find(sub, pos)) != string::npos) {
        count++;
        pos += sub.size();
    }
    return count;
}`
  },
  {
    id: 'str-anagram',
    category: 'String',
    name: 'isAnagram',
    signature: 'bool isAnagram(string a, string b)',
    description: 'Check if two strings are anagrams',
    includes: ['string', 'algorithm'],
    code:
`bool isAnagram(string a, string b) {
    sort(a.begin(), a.end());
    sort(b.begin(), b.end());
    return a == b;
}`
  },
  {
    id: 'str-capitalize',
    category: 'String',
    name: 'capitalizeWords',
    signature: 'string capitalizeWords(string s)',
    description: 'Capitalize first letter of every word',
    includes: ['string', 'cctype'],
    code:
`string capitalizeWords(string s) {
    bool newWord = true;
    for (char& c : s) {
        if (isspace((unsigned char)c)) { newWord = true; }
        else if (newWord) { c = (char)toupper((unsigned char)c); newWord = false; }
    }
    return s;
}`
  },
  {
    id: 'str-removespaces',
    category: 'String',
    name: 'removeSpaces',
    signature: 'string removeSpaces(string s)',
    description: 'Remove all whitespace characters',
    includes: ['string', 'algorithm', 'cctype'],
    code:
`string removeSpaces(string s) {
    s.erase(remove_if(s.begin(), s.end(),
        [](unsigned char c){ return isspace(c); }), s.end());
    return s;
}`
  },
  {
    id: 'str-longestword',
    category: 'String',
    name: 'longestWord',
    signature: 'string longestWord(const string& s)',
    description: 'Return the longest word in a sentence',
    includes: ['string', 'sstream'],
    code:
`string longestWord(const string& s) {
    istringstream iss(s);
    string word, longest;
    while (iss >> word)
        if (word.size() > longest.size()) longest = word;
    return longest;
}`
  },
  {
    id: 'str-rle',
    category: 'String',
    name: 'runLengthEncode',
    signature: 'string runLengthEncode(const string& s)',
    description: 'Run-length encoding: "aaabbc" → "3a2b1c"',
    includes: ['string'],
    code:
`string runLengthEncode(const string& s) {
    if (s.empty()) return "";
    string result;
    int count = 1;
    for (size_t i = 1; i <= s.size(); i++) {
        if (i < s.size() && s[i] == s[i-1]) { count++; }
        else { result += to_string(count) + s[i-1]; count = 1; }
    }
    return result;
}`
  },
  {
    id: 'str-levenshtein',
    category: 'String',
    name: 'levenshteinDistance',
    signature: 'int levenshteinDistance(const string& a, const string& b)',
    description: 'Edit distance (min insertions/deletions/substitutions)',
    includes: ['string', 'vector'],
    code:
`int levenshteinDistance(const string& a, const string& b) {
    int m = (int)a.size(), n = (int)b.size();
    vector<vector<int>> dp(m+1, vector<int>(n+1));
    for (int i = 0; i <= m; i++) dp[i][0] = i;
    for (int j = 0; j <= n; j++) dp[0][j] = j;
    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            dp[i][j] = (a[i-1] == b[j-1])
                ? dp[i-1][j-1]
                : 1 + min({dp[i-1][j], dp[i][j-1], dp[i-1][j-1]});
    return dp[m][n];
}`
  },

  // ═══════════════════════ SORTING ═════════════════════════════════════════
  {
    id: 'sort-bubble',
    category: 'Sorting',
    name: 'bubbleSort',
    signature: 'void bubbleSort(vector<int>& arr)',
    description: 'Bubble sort — O(n²) time, O(1) space, stable',
    includes: ['vector'],
    code:
`void bubbleSort(vector<int>& arr) {
    int n = (int)arr.size();
    for (int i = 0; i < n - 1; i++) {
        bool swapped = false;
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j+1]) { swap(arr[j], arr[j+1]); swapped = true; }
        }
        if (!swapped) break;
    }
}`
  },
  {
    id: 'sort-selection',
    category: 'Sorting',
    name: 'selectionSort',
    signature: 'void selectionSort(vector<int>& arr)',
    description: 'Selection sort — O(n²) time, O(1) space',
    includes: ['vector'],
    code:
`void selectionSort(vector<int>& arr) {
    int n = (int)arr.size();
    for (int i = 0; i < n - 1; i++) {
        int minIdx = i;
        for (int j = i + 1; j < n; j++)
            if (arr[j] < arr[minIdx]) minIdx = j;
        if (minIdx != i) swap(arr[i], arr[minIdx]);
    }
}`
  },
  {
    id: 'sort-insertion',
    category: 'Sorting',
    name: 'insertionSort',
    signature: 'void insertionSort(vector<int>& arr)',
    description: 'Insertion sort — O(n²) time, O(1) space, stable',
    includes: ['vector'],
    code:
`void insertionSort(vector<int>& arr) {
    int n = (int)arr.size();
    for (int i = 1; i < n; i++) {
        int key = arr[i], j = i - 1;
        while (j >= 0 && arr[j] > key) { arr[j+1] = arr[j]; j--; }
        arr[j+1] = key;
    }
}`
  },
  {
    id: 'sort-merge',
    category: 'Sorting',
    name: 'mergeSort',
    signature: 'void mergeSort(vector<int>& arr, int l, int r)',
    description: 'Merge sort — O(n log n) time, O(n) space, stable',
    includes: ['vector'],
    code:
`void _merge(vector<int>& arr, int l, int m, int r) {
    vector<int> L(arr.begin()+l, arr.begin()+m+1);
    vector<int> R(arr.begin()+m+1, arr.begin()+r+1);
    int i = 0, j = 0, k = l;
    while (i < (int)L.size() && j < (int)R.size())
        arr[k++] = (L[i] <= R[j]) ? L[i++] : R[j++];
    while (i < (int)L.size()) arr[k++] = L[i++];
    while (j < (int)R.size()) arr[k++] = R[j++];
}
void mergeSort(vector<int>& arr, int l, int r) {
    if (l >= r) return;
    int m = l + (r - l) / 2;
    mergeSort(arr, l, m);
    mergeSort(arr, m+1, r);
    _merge(arr, l, m, r);
}`
  },
  {
    id: 'sort-quick',
    category: 'Sorting',
    name: 'quickSort',
    signature: 'void quickSort(vector<int>& arr, int lo, int hi)',
    description: 'Quick sort — O(n log n) avg, in-place, unstable',
    includes: ['vector'],
    code:
`int _partition(vector<int>& arr, int lo, int hi) {
    int pivot = arr[hi], i = lo - 1;
    for (int j = lo; j < hi; j++)
        if (arr[j] <= pivot) swap(arr[++i], arr[j]);
    swap(arr[i+1], arr[hi]);
    return i + 1;
}
void quickSort(vector<int>& arr, int lo, int hi) {
    if (lo < hi) {
        int pi = _partition(arr, lo, hi);
        quickSort(arr, lo, pi - 1);
        quickSort(arr, pi + 1, hi);
    }
}`
  },
  {
    id: 'sort-counting',
    category: 'Sorting',
    name: 'countingSort',
    signature: 'void countingSort(vector<int>& arr)',
    description: 'Counting sort — O(n+k) time, best for small ranges',
    includes: ['vector', 'algorithm'],
    code:
`void countingSort(vector<int>& arr) {
    if (arr.empty()) return;
    int maxVal = *max_element(arr.begin(), arr.end());
    int minVal = *min_element(arr.begin(), arr.end());
    vector<int> count(maxVal - minVal + 1, 0);
    for (int x : arr) count[x - minVal]++;
    int idx = 0;
    for (int i = 0; i < (int)count.size(); i++)
        while (count[i]-- > 0) arr[idx++] = i + minVal;
}`
  },
  {
    id: 'sort-heap',
    category: 'Sorting',
    name: 'heapSort',
    signature: 'void heapSort(vector<int>& arr)',
    description: 'Heap sort — O(n log n) time, O(1) space, unstable',
    includes: ['vector'],
    code:
`void _heapify(vector<int>& arr, int n, int i) {
    int largest = i, l = 2*i+1, r = 2*i+2;
    if (l < n && arr[l] > arr[largest]) largest = l;
    if (r < n && arr[r] > arr[largest]) largest = r;
    if (largest != i) { swap(arr[i], arr[largest]); _heapify(arr, n, largest); }
}
void heapSort(vector<int>& arr) {
    int n = (int)arr.size();
    for (int i = n/2-1; i >= 0; i--) _heapify(arr, n, i);
    for (int i = n-1; i > 0; i--) { swap(arr[0], arr[i]); _heapify(arr, i, 0); }
}`
  },
  {
    id: 'sort-shell',
    category: 'Sorting',
    name: 'shellSort',
    signature: 'void shellSort(vector<int>& arr)',
    description: 'Shell sort — O(n log²n) time, O(1) space',
    includes: ['vector'],
    code:
`void shellSort(vector<int>& arr) {
    int n = (int)arr.size();
    for (int gap = n/2; gap > 0; gap /= 2)
        for (int i = gap; i < n; i++) {
            int temp = arr[i], j = i;
            while (j >= gap && arr[j-gap] > temp) { arr[j] = arr[j-gap]; j -= gap; }
            arr[j] = temp;
        }
}`
  },

  // ═══════════════════════ SEARCHING ═══════════════════════════════════════
  {
    id: 'srch-linear',
    category: 'Searching',
    name: 'linearSearch',
    signature: 'int linearSearch(const vector<int>& arr, int target)',
    description: 'Linear search — returns first index or -1',
    includes: ['vector'],
    code:
`int linearSearch(const vector<int>& arr, int target) {
    for (int i = 0; i < (int)arr.size(); i++)
        if (arr[i] == target) return i;
    return -1;
}`
  },
  {
    id: 'srch-binary',
    category: 'Searching',
    name: 'binarySearch',
    signature: 'int binarySearch(const vector<int>& arr, int target)',
    description: 'Binary search on sorted array — O(log n)',
    includes: ['vector'],
    code:
`int binarySearch(const vector<int>& arr, int target) {
    int lo = 0, hi = (int)arr.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}`
  },
  {
    id: 'srch-findall',
    category: 'Searching',
    name: 'findAll',
    signature: 'vector<int> findAll(const vector<int>& arr, int target)',
    description: 'Find indices of all occurrences',
    includes: ['vector'],
    code:
`vector<int> findAll(const vector<int>& arr, int target) {
    vector<int> indices;
    for (int i = 0; i < (int)arr.size(); i++)
        if (arr[i] == target) indices.push_back(i);
    return indices;
}`
  },
  {
    id: 'srch-first',
    category: 'Searching',
    name: 'findFirstOccurrence',
    signature: 'int findFirstOccurrence(const vector<int>& arr, int target)',
    description: 'Binary search for first occurrence in sorted array',
    includes: ['vector'],
    code:
`int findFirstOccurrence(const vector<int>& arr, int target) {
    int lo = 0, hi = (int)arr.size()-1, result = -1;
    while (lo <= hi) {
        int mid = lo + (hi-lo)/2;
        if (arr[mid] == target) { result = mid; hi = mid-1; }
        else if (arr[mid] < target) lo = mid+1;
        else hi = mid-1;
    }
    return result;
}`
  },
  {
    id: 'srch-last',
    category: 'Searching',
    name: 'findLastOccurrence',
    signature: 'int findLastOccurrence(const vector<int>& arr, int target)',
    description: 'Binary search for last occurrence in sorted array',
    includes: ['vector'],
    code:
`int findLastOccurrence(const vector<int>& arr, int target) {
    int lo = 0, hi = (int)arr.size()-1, result = -1;
    while (lo <= hi) {
        int mid = lo + (hi-lo)/2;
        if (arr[mid] == target) { result = mid; lo = mid+1; }
        else if (arr[mid] < target) lo = mid+1;
        else hi = mid-1;
    }
    return result;
}`
  },

  // ═══════════════════════ VECTOR ══════════════════════════════════════════
  {
    id: 'vec-print',
    category: 'Vector',
    name: 'printVector',
    signature: 'void printVector(const vector<int>& v)',
    description: 'Print all elements space-separated with newline',
    includes: ['vector', 'iostream'],
    code:
`void printVector(const vector<int>& v) {
    for (int i = 0; i < (int)v.size(); i++) {
        if (i) cout << " ";
        cout << v[i];
    }
    cout << "\\n";
}`
  },
  {
    id: 'vec-read',
    category: 'Vector',
    name: 'readVector',
    signature: 'vector<int> readVector(int n)',
    description: 'Read n integers from stdin',
    includes: ['vector', 'iostream'],
    code:
`vector<int> readVector(int n) {
    vector<int> v(n);
    for (int i = 0; i < n; i++) cin >> v[i];
    return v;
}`
  },
  {
    id: 'vec-sum',
    category: 'Vector',
    name: 'sumVector',
    signature: 'long long sumVector(const vector<int>& v)',
    description: 'Return sum of all elements',
    includes: ['vector'],
    code:
`long long sumVector(const vector<int>& v) {
    long long sum = 0;
    for (int x : v) sum += x;
    return sum;
}`
  },
  {
    id: 'vec-maxmin',
    category: 'Vector',
    name: 'maxMinVector',
    signature: 'pair<int,int> maxMinVector(const vector<int>& v)',
    description: 'Return {max, min} of vector elements',
    includes: ['vector', 'utility'],
    code:
`pair<int,int> maxMinVector(const vector<int>& v) {
    int mx = v[0], mn = v[0];
    for (int x : v) { mx = max(mx, x); mn = min(mn, x); }
    return {mx, mn};
}`
  },
  {
    id: 'vec-avg',
    category: 'Vector',
    name: 'averageVector',
    signature: 'double averageVector(const vector<int>& v)',
    description: 'Return the arithmetic mean',
    includes: ['vector'],
    code:
`double averageVector(const vector<int>& v) {
    if (v.empty()) return 0.0;
    long long sum = 0;
    for (int x : v) sum += x;
    return (double)sum / (int)v.size();
}`
  },
  {
    id: 'vec-freq',
    category: 'Vector',
    name: 'frequencyMap',
    signature: 'map<int,int> frequencyMap(const vector<int>& v)',
    description: 'Count occurrences of each unique element',
    includes: ['vector', 'map'],
    code:
`map<int,int> frequencyMap(const vector<int>& v) {
    map<int,int> freq;
    for (int x : v) freq[x]++;
    return freq;
}`
  },
  {
    id: 'vec-unique',
    category: 'Vector',
    name: 'removeDuplicates',
    signature: 'vector<int> removeDuplicates(vector<int> v)',
    description: 'Remove duplicate elements (sorts input)',
    includes: ['vector', 'algorithm'],
    code:
`vector<int> removeDuplicates(vector<int> v) {
    sort(v.begin(), v.end());
    v.erase(unique(v.begin(), v.end()), v.end());
    return v;
}`
  },
  {
    id: 'vec-prefix',
    category: 'Vector',
    name: 'prefixSum',
    signature: 'vector<long long> prefixSum(const vector<int>& v)',
    description: 'Build prefix sum array (index 0 = 0, 1-indexed sums)',
    includes: ['vector'],
    code:
`vector<long long> prefixSum(const vector<int>& v) {
    int n = (int)v.size();
    vector<long long> pre(n + 1, 0);
    for (int i = 0; i < n; i++) pre[i+1] = pre[i] + v[i];
    return pre;
}`
  },
  {
    id: 'vec-2dprint',
    category: 'Vector',
    name: 'print2DVector',
    signature: 'void print2DVector(const vector<vector<int>>& mat)',
    description: 'Print a 2D vector (matrix) row by row',
    includes: ['vector', 'iostream'],
    code:
`void print2DVector(const vector<vector<int>>& mat) {
    for (const auto& row : mat) {
        for (int i = 0; i < (int)row.size(); i++) {
            if (i) cout << " ";
            cout << row[i];
        }
        cout << "\\n";
    }
}`
  },
  {
    id: 'vec-rotate',
    category: 'Vector',
    name: 'rotateLeft',
    signature: 'void rotateLeft(vector<int>& v, int k)',
    description: 'Rotate vector left by k positions',
    includes: ['vector', 'algorithm'],
    code:
`void rotateLeft(vector<int>& v, int k) {
    int n = (int)v.size();
    if (n == 0) return;
    k %= n;
    if (k < 0) k += n;
    rotate(v.begin(), v.begin() + k, v.end());
}`
  },

  // ═══════════════════════ LINKED LIST ═════════════════════════════════════
  {
    id: 'll-full',
    category: 'Linked List',
    name: 'ListNode (full set)',
    signature: 'struct ListNode + create/print/reverse',
    description: 'Singly linked list: node definition, create from vector, print, reverse',
    includes: ['iostream', 'vector'],
    code:
`struct ListNode {
    int val;
    ListNode* next;
    ListNode(int x) : val(x), next(nullptr) {}
};

ListNode* createList(const vector<int>& vals) {
    if (vals.empty()) return nullptr;
    ListNode* head = new ListNode(vals[0]);
    ListNode* cur = head;
    for (int i = 1; i < (int)vals.size(); i++) {
        cur->next = new ListNode(vals[i]);
        cur = cur->next;
    }
    return head;
}

void printList(ListNode* head) {
    while (head) {
        cout << head->val;
        if (head->next) cout << " -> ";
        head = head->next;
    }
    cout << "\\n";
}

ListNode* reverseList(ListNode* head) {
    ListNode* prev = nullptr;
    while (head) {
        ListNode* nxt = head->next;
        head->next = prev;
        prev = head;
        head = nxt;
    }
    return prev;
}

int listLength(ListNode* head) {
    int len = 0;
    while (head) { len++; head = head->next; }
    return len;
}

bool hasCycle(ListNode* head) {
    ListNode* slow = head, *fast = head;
    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
        if (slow == fast) return true;
    }
    return false;
}`
  },
  {
    id: 'll-delete',
    category: 'Linked List',
    name: 'deleteList',
    signature: 'void deleteList(ListNode* head)',
    description: 'Free all memory allocated by a linked list',
    includes: [],
    code:
`// Assumes ListNode is already defined
void deleteList(ListNode* head) {
    while (head) {
        ListNode* nxt = head->next;
        delete head;
        head = nxt;
    }
}`
  },
  {
    id: 'll-middle',
    category: 'Linked List',
    name: 'middleNode',
    signature: 'ListNode* middleNode(ListNode* head)',
    description: 'Find the middle node using slow/fast pointers',
    includes: [],
    code:
`// Assumes ListNode is already defined
ListNode* middleNode(ListNode* head) {
    ListNode* slow = head, *fast = head;
    while (fast && fast->next) {
        slow = slow->next;
        fast = fast->next->next;
    }
    return slow;
}`
  },

  // ═══════════════════════ GRAPH ════════════════════════════════════════════
  {
    id: 'graph-bfs',
    category: 'Graph',
    name: 'BFS',
    signature: 'vector<int> bfs(int start, const vector<vector<int>>& adj)',
    description: 'Breadth-First Search — returns visit order',
    includes: ['vector', 'queue'],
    code:
`vector<int> bfs(int start, const vector<vector<int>>& adj) {
    int n = (int)adj.size();
    vector<bool> visited(n, false);
    vector<int> order;
    queue<int> q;
    q.push(start);
    visited[start] = true;
    while (!q.empty()) {
        int u = q.front(); q.pop();
        order.push_back(u);
        for (int v : adj[u])
            if (!visited[v]) { visited[v] = true; q.push(v); }
    }
    return order;
}`
  },
  {
    id: 'graph-dfs',
    category: 'Graph',
    name: 'DFS',
    signature: 'void dfs(int u, const vector<vector<int>>& adj, vector<bool>& visited)',
    description: 'Depth-First Search — recursive',
    includes: ['vector', 'iostream'],
    code:
`void dfs(int u, const vector<vector<int>>& adj, vector<bool>& visited) {
    visited[u] = true;
    cout << u << " ";
    for (int v : adj[u])
        if (!visited[v]) dfs(v, adj, visited);
}`
  },
  {
    id: 'graph-dijkstra',
    category: 'Graph',
    name: 'dijkstra',
    signature: 'vector<int> dijkstra(int src, const vector<vector<pair<int,int>>>& adj, int n)',
    description: "Dijkstra's shortest paths — returns dist[] from src",
    includes: ['vector', 'queue', 'climits'],
    code:
`vector<int> dijkstra(int src, const vector<vector<pair<int,int>>>& adj, int n) {
    // adj[u] = { {weight, v}, ... }
    vector<int> dist(n, INT_MAX);
    priority_queue<pair<int,int>, vector<pair<int,int>>, greater<pair<int,int>>> pq;
    dist[src] = 0;
    pq.push({0, src});
    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d > dist[u]) continue;
        for (auto [w, v] : adj[u]) {
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                pq.push({dist[v], v});
            }
        }
    }
    return dist;
}`
  },
  {
    id: 'graph-union-find',
    category: 'Graph',
    name: 'UnionFind (DSU)',
    signature: 'struct UnionFind',
    description: 'Disjoint Set Union — union by rank with path compression',
    includes: ['vector'],
    code:
`struct UnionFind {
    vector<int> parent, rank_;
    UnionFind(int n) : parent(n), rank_(n, 0) {
        for (int i = 0; i < n; i++) parent[i] = i;
    }
    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }
    bool unite(int x, int y) {
        int px = find(x), py = find(y);
        if (px == py) return false;
        if (rank_[px] < rank_[py]) swap(px, py);
        parent[py] = px;
        if (rank_[px] == rank_[py]) rank_[px]++;
        return true;
    }
    bool connected(int x, int y) { return find(x) == find(y); }
};`
  },

  // ═══════════════════════ DYNAMIC PROGRAMMING ═════════════════════════════
  {
    id: 'dp-maxsubarray',
    category: 'Dynamic Programming',
    name: 'maxSubarraySum',
    signature: 'int maxSubarraySum(const vector<int>& arr)',
    description: "Kadane's algorithm — maximum contiguous subarray sum",
    includes: ['vector'],
    code:
`int maxSubarraySum(const vector<int>& arr) {
    int maxSum = arr[0], curr = arr[0];
    for (int i = 1; i < (int)arr.size(); i++) {
        curr = max(arr[i], curr + arr[i]);
        maxSum = max(maxSum, curr);
    }
    return maxSum;
}`
  },
  {
    id: 'dp-lis',
    category: 'Dynamic Programming',
    name: 'LIS',
    signature: 'int LIS(const vector<int>& arr)',
    description: 'Length of Longest Increasing Subsequence — O(n log n)',
    includes: ['vector', 'algorithm'],
    code:
`int LIS(const vector<int>& arr) {
    vector<int> tails;
    for (int x : arr) {
        auto it = lower_bound(tails.begin(), tails.end(), x);
        if (it == tails.end()) tails.push_back(x);
        else *it = x;
    }
    return (int)tails.size();
}`
  },
  {
    id: 'dp-lcs',
    category: 'Dynamic Programming',
    name: 'LCS',
    signature: 'int LCS(const string& a, const string& b)',
    description: 'Length of Longest Common Subsequence',
    includes: ['string', 'vector'],
    code:
`int LCS(const string& a, const string& b) {
    int m = (int)a.size(), n = (int)b.size();
    vector<vector<int>> dp(m+1, vector<int>(n+1, 0));
    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            dp[i][j] = (a[i-1] == b[j-1])
                ? dp[i-1][j-1] + 1
                : max(dp[i-1][j], dp[i][j-1]);
    return dp[m][n];
}`
  },
  {
    id: 'dp-knapsack',
    category: 'Dynamic Programming',
    name: 'knapsack01',
    signature: 'int knapsack01(int W, vector<int>& wt, vector<int>& val)',
    description: '0/1 Knapsack — max value with weight capacity W',
    includes: ['vector'],
    code:
`int knapsack01(int W, vector<int>& wt, vector<int>& val) {
    int n = (int)wt.size();
    vector<vector<int>> dp(n+1, vector<int>(W+1, 0));
    for (int i = 1; i <= n; i++)
        for (int w = 0; w <= W; w++) {
            dp[i][w] = dp[i-1][w];
            if (wt[i-1] <= w)
                dp[i][w] = max(dp[i][w], val[i-1] + dp[i-1][w-wt[i-1]]);
        }
    return dp[n][W];
}`
  },
  {
    id: 'dp-coinchange',
    category: 'Dynamic Programming',
    name: 'coinChange',
    signature: 'int coinChange(vector<int>& coins, int amount)',
    description: 'Minimum coins to make amount (-1 if impossible)',
    includes: ['vector'],
    code:
`int coinChange(vector<int>& coins, int amount) {
    vector<int> dp(amount+1, amount+1);
    dp[0] = 0;
    for (int i = 1; i <= amount; i++)
        for (int c : coins)
            if (c <= i) dp[i] = min(dp[i], dp[i-c]+1);
    return dp[amount] > amount ? -1 : dp[amount];
}`
  },
  {
    id: 'dp-fibdp',
    category: 'Dynamic Programming',
    name: 'fibonacciDP',
    signature: 'vector<long long> fibonacciDP(int n)',
    description: 'Return first n Fibonacci numbers using DP tabulation',
    includes: ['vector'],
    code:
`vector<long long> fibonacciDP(int n) {
    if (n <= 0) return {};
    vector<long long> dp(n + 1);
    dp[0] = 0;
    if (n >= 1) dp[1] = 1;
    for (int i = 2; i <= n; i++) dp[i] = dp[i-1] + dp[i-2];
    return dp;
}`
  },
  {
    id: 'dp-matrixchain',
    category: 'Dynamic Programming',
    name: 'matrixChainOrder',
    signature: 'int matrixChainOrder(vector<int>& dims)',
    description: 'Minimum scalar multiplications for matrix chain',
    includes: ['vector'],
    code:
`int matrixChainOrder(vector<int>& dims) {
    int n = (int)dims.size() - 1; // number of matrices
    vector<vector<int>> dp(n, vector<int>(n, 0));
    for (int len = 2; len <= n; len++)
        for (int i = 0; i <= n - len; i++) {
            int j = i + len - 1;
            dp[i][j] = INT_MAX;
            for (int k = i; k < j; k++)
                dp[i][j] = min(dp[i][j], dp[i][k] + dp[k+1][j] + dims[i]*dims[k+1]*dims[j+1]);
        }
    return dp[0][n-1];
}`
  },

  // ═══════════════════════ BIT OPS ═════════════════════════════════════════
  {
    id: 'bit-ispow2',
    category: 'Bit Ops',
    name: 'isPowerOf2',
    signature: 'bool isPowerOf2(int n)',
    description: 'Check if n is a power of 2',
    includes: [],
    code:
`bool isPowerOf2(int n) {
    return n > 0 && (n & (n - 1)) == 0;
}`
  },
  {
    id: 'bit-count',
    category: 'Bit Ops',
    name: 'countSetBits',
    signature: 'int countSetBits(int n)',
    description: 'Count 1-bits using Brian Kernighan method',
    includes: [],
    code:
`int countSetBits(int n) {
    int count = 0;
    while (n) { n &= n - 1; count++; }
    return count;
}`
  },
  {
    id: 'bit-set',
    category: 'Bit Ops',
    name: 'setBit',
    signature: 'int setBit(int n, int pos)',
    description: 'Set the bit at position pos (0-indexed from right)',
    includes: [],
    code:
`int setBit(int n, int pos) { return n | (1 << pos); }`
  },
  {
    id: 'bit-clear',
    category: 'Bit Ops',
    name: 'clearBit',
    signature: 'int clearBit(int n, int pos)',
    description: 'Clear the bit at position pos',
    includes: [],
    code:
`int clearBit(int n, int pos) { return n & ~(1 << pos); }`
  },
  {
    id: 'bit-toggle',
    category: 'Bit Ops',
    name: 'toggleBit',
    signature: 'int toggleBit(int n, int pos)',
    description: 'Toggle the bit at position pos',
    includes: [],
    code:
`int toggleBit(int n, int pos) { return n ^ (1 << pos); }`
  },
  {
    id: 'bit-check',
    category: 'Bit Ops',
    name: 'checkBit',
    signature: 'bool checkBit(int n, int pos)',
    description: 'Check if bit at pos is set',
    includes: [],
    code:
`bool checkBit(int n, int pos) { return (n >> pos) & 1; }`
  },
  {
    id: 'bit-subsets',
    category: 'Bit Ops',
    name: 'printSubsets',
    signature: 'void printSubsets(vector<int>& arr)',
    description: 'Print all 2^n subsets using bitmask enumeration',
    includes: ['vector', 'iostream'],
    code:
`void printSubsets(vector<int>& arr) {
    int n = (int)arr.size();
    for (int mask = 0; mask < (1 << n); mask++) {
        cout << "{ ";
        for (int i = 0; i < n; i++)
            if (mask & (1 << i)) cout << arr[i] << " ";
        cout << "}\\n";
    }
}`
  },
  {
    id: 'bit-next-perm',
    category: 'Bit Ops',
    name: 'nextPowerOf2',
    signature: 'int nextPowerOf2(int n)',
    description: 'Smallest power of 2 ≥ n',
    includes: [],
    code:
`int nextPowerOf2(int n) {
    if (n <= 1) return 1;
    int p = 1;
    while (p < n) p <<= 1;
    return p;
}`
  },
];

// ── FunctionsPanel class ──────────────────────────────────────────────────────
class FunctionsPanel {
  constructor() {
    this._panel       = null;
    this._backdrop    = null;
    this._modal       = null;
    this._isOpen      = false;
    this._activeTab   = 'All';
    this._searchQuery = '';
    this._editingId   = null; // for editing a user function
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────
  init() {
    this._buildDOM();
    this._bindEvents();
    this._renderList();
  }

  // ── Build all DOM ─────────────────────────────────────────────────────────
  _buildDOM() {
    // Side panel
    const panel = document.createElement('div');
    panel.id = 'functions-panel';
    panel.className = 'functions-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Function Library');
    panel.innerHTML = this._panelHTML();
    document.body.appendChild(panel);
    this._panel = panel;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'functions-backdrop';
    backdrop.className = 'functions-backdrop';
    document.body.appendChild(backdrop);
    this._backdrop = backdrop;

    // Add/Edit Custom Function modal
    const modal = document.createElement('div');
    modal.id = 'fn-add-modal';
    modal.className = 'fn-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = this._modalHTML();
    document.body.appendChild(modal);
    this._modal = modal;
  }

  _panelHTML() {
    const categories = this._getCategories();
    const tabs = categories.map(cat => {
      const icon = cat === 'Suggested' ? '★' : cat === 'My Functions' ? '✦' : '';
      return `<button class="fn-tab" data-tab="${cat}" title="${cat}">
        ${icon ? `<span class="fn-tab-icon">${icon}</span>` : ''}
        <span>${cat}</span>
      </button>`;
    }).join('');

    return `
      <div class="fn-panel-header">
        <div class="fn-panel-title">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
            <rect x="1" y="2" width="14" height="12" rx="2"/>
            <path d="M5 6h6M5 10h4"/>
            <path d="M1 5h14" stroke-width="1"/>
          </svg>
          Using Functions
        </div>
        <button id="btn-close-fn-panel" class="btn-icon" title="Close panel" aria-label="Close panel">
          <svg width="11" height="11" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/>
          </svg>
        </button>
      </div>

      <div class="fn-search-bar">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/>
        </svg>
        <input id="fn-search-input" type="text" class="fn-search-input"
          placeholder="Search functions…" autocomplete="off" spellcheck="false"/>
      </div>

      <div class="fn-tab-bar" id="fn-tab-bar">${tabs}</div>

      <div class="fn-list" id="fn-list"></div>

      <div class="fn-panel-footer">
        <button id="btn-add-custom-fn" class="fn-add-btn">
          <svg width="11" height="11" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <line x1="6.5" y1="1" x2="6.5" y2="12"/><line x1="1" y1="6.5" x2="12" y2="6.5"/>
          </svg>
          Add Custom Function
        </button>
      </div>
    `;
  }

  _modalHTML() {
    const categoryOptions = this._getBuiltinCategories()
      .map(c => `<option value="${c}">${c}</option>`).join('');

    return `
      <div class="fn-modal-box">
        <div class="fn-modal-header">
          <span class="fn-modal-title" id="fn-modal-title-text">Add Custom Function</span>
          <button id="btn-close-fn-modal" class="btn-icon" title="Close">
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5">
              <line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/>
            </svg>
          </button>
        </div>
        <div class="fn-modal-body">
          <div class="fn-modal-field">
            <label class="fn-modal-label">Function Name *</label>
            <input id="fn-input-name" type="text" class="fn-modal-input" placeholder="e.g. myBinarySearch"/>
          </div>
          <div class="fn-modal-field">
            <label class="fn-modal-label">Category</label>
            <select id="fn-input-category" class="fn-modal-input fn-modal-select">
              ${categoryOptions}
              <option value="My Functions" selected>My Functions</option>
            </select>
          </div>
          <div class="fn-modal-field">
            <label class="fn-modal-label">Signature *</label>
            <input id="fn-input-signature" type="text" class="fn-modal-input fn-modal-mono"
              placeholder="e.g. int myBinarySearch(vector&lt;int&gt;&amp; arr, int target)"/>
          </div>
          <div class="fn-modal-field">
            <label class="fn-modal-label">Description</label>
            <input id="fn-input-description" type="text" class="fn-modal-input" placeholder="What does this function do?"/>
          </div>
          <div class="fn-modal-field">
            <label class="fn-modal-label">Required #includes (comma-separated, without angle brackets)</label>
            <input id="fn-input-includes" type="text" class="fn-modal-input fn-modal-mono"
              placeholder="e.g. vector, algorithm, iostream"/>
          </div>
          <div class="fn-modal-field">
            <label class="fn-modal-label">Function Code *</label>
            <textarea id="fn-input-code" class="fn-modal-textarea fn-modal-mono"
              placeholder="// Paste or type your function here…" spellcheck="false"></textarea>
          </div>
        </div>
        <div class="fn-modal-footer">
          <button id="btn-cancel-fn-modal" class="fn-modal-cancel">Cancel</button>
          <button id="btn-save-fn-modal" class="btn-run fn-modal-save">Save Function</button>
        </div>
      </div>
    `;
  }

  // ── Events ────────────────────────────────────────────────────────────────
  _bindEvents() {
    // Close button
    document.getElementById('btn-close-fn-panel').addEventListener('click', () => this.close());

    // Backdrop click
    this._backdrop.addEventListener('click', () => this.close());

    // Search
    document.getElementById('fn-search-input').addEventListener('input', (e) => {
      this._searchQuery = e.target.value.toLowerCase().trim();
      this._renderList();
    });

    // Tab clicks
    document.getElementById('fn-tab-bar').addEventListener('click', (e) => {
      const btn = e.target.closest('.fn-tab');
      if (!btn) return;
      this._activeTab = btn.dataset.tab;
      this._updateTabUI();
      this._renderList();
    });

    // Add custom function button
    document.getElementById('btn-add-custom-fn').addEventListener('click', () => {
      this._openModal();
    });

    // Modal close
    document.getElementById('btn-close-fn-modal').addEventListener('click', () => this._closeModal());
    document.getElementById('btn-cancel-fn-modal').addEventListener('click', () => this._closeModal());

    // Save custom function
    document.getElementById('btn-save-fn-modal').addEventListener('click', () => this._saveCustomFunction());

    // Click outside modal to close
    this._modal.addEventListener('click', (e) => {
      if (e.target === this._modal) this._closeModal();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this._modal.classList.contains('open')) { this._closeModal(); return; }
        if (this._isOpen) this.close();
      }
    });
  }

  // ── Panel open/close ──────────────────────────────────────────────────────
  open() {
    this._isOpen = true;
    this._panel.classList.add('open');
    this._backdrop.classList.add('open');
    // Update suggested tab based on current code
    this._renderList();
    setTimeout(() => document.getElementById('fn-search-input')?.focus(), 280);
  }

  close() {
    this._isOpen = false;
    this._panel.classList.remove('open');
    this._backdrop.classList.remove('open');
  }

  toggle() {
    this._isOpen ? this.close() : this.open();
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  _getCategories() {
    return ['Suggested', 'All', 'Math', 'String', 'Sorting', 'Searching', 'Vector', 'Linked List', 'Graph', 'Dynamic Programming', 'Bit Ops', 'My Functions'];
  }

  _getBuiltinCategories() {
    return ['Math', 'String', 'Sorting', 'Searching', 'Vector', 'Linked List', 'Graph', 'Dynamic Programming', 'Bit Ops'];
  }

  _getUserFunctions() {
    try {
      return JSON.parse(localStorage.getItem(LS_USER_FN_KEY) || '[]');
    } catch { return []; }
  }

  _saveUserFunctions(fns) {
    try { localStorage.setItem(LS_USER_FN_KEY, JSON.stringify(fns)); } catch { /* ignore */ }
  }

  /** Detect which categories to suggest based on #includes in editor */
  _getSuggestedCategories() {
    if (!window.zenithEditor) return [];
    const includes = zenithEditor.getIncludes();
    if (includes.includes('bits/stdc++.h')) return null; // null = all

    const suggested = new Set();
    for (const inc of includes) {
      const cats = INCLUDE_CATEGORY_MAP[inc];
      if (cats === null) return null; // all
      if (cats) cats.forEach(c => suggested.add(c));
    }
    return [...suggested];
  }

  _getFilteredFunctions() {
    const userFns = this._getUserFunctions().map(fn => ({ ...fn, isUser: true }));
    let pool;

    if (this._activeTab === 'Suggested') {
      const suggestedCats = this._getSuggestedCategories();
      if (suggestedCats === null) {
        pool = [...ZENITH_FUNCTION_LIBRARY, ...userFns];
      } else if (suggestedCats.length === 0) {
        pool = [];
      } else {
        pool = [...ZENITH_FUNCTION_LIBRARY, ...userFns]
          .filter(fn => suggestedCats.includes(fn.category));
      }
    } else if (this._activeTab === 'All') {
      pool = [...ZENITH_FUNCTION_LIBRARY, ...userFns];
    } else if (this._activeTab === 'My Functions') {
      pool = userFns;
    } else {
      pool = [...ZENITH_FUNCTION_LIBRARY, ...userFns]
        .filter(fn => fn.category === this._activeTab);
    }

    if (this._searchQuery) {
      const q = this._searchQuery;
      pool = pool.filter(fn =>
        fn.name.toLowerCase().includes(q) ||
        fn.description.toLowerCase().includes(q) ||
        fn.signature.toLowerCase().includes(q) ||
        fn.category.toLowerCase().includes(q)
      );
    }

    return pool;
  }

  _renderList() {
    const list = document.getElementById('fn-list');
    if (!list) return;
    this._updateTabUI();

    const fns = this._getFilteredFunctions();

    if (fns.length === 0) {
      list.innerHTML = `
        <div class="fn-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.35">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <p>${this._activeTab === 'Suggested'
            ? 'Add #include headers to get smart suggestions'
            : this._activeTab === 'My Functions'
            ? 'No custom functions yet.<br>Click "Add Custom Function" below.'
            : 'No functions match your search.'}</p>
        </div>`;
      return;
    }

    // Group by category when showing "All" or "Suggested"
    const showGroups = this._activeTab === 'All' || this._activeTab === 'Suggested';

    if (showGroups) {
      const grouped = {};
      for (const fn of fns) {
        if (!grouped[fn.category]) grouped[fn.category] = [];
        grouped[fn.category].push(fn);
      }
      list.innerHTML = Object.entries(grouped).map(([cat, catFns]) => `
        <div class="fn-group">
          <div class="fn-group-label">${cat}</div>
          ${catFns.map(fn => this._cardHTML(fn)).join('')}
        </div>
      `).join('');
    } else {
      list.innerHTML = fns.map(fn => this._cardHTML(fn)).join('');
    }

    // Bind insert + delete buttons
    list.querySelectorAll('.fn-insert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const fn = [...ZENITH_FUNCTION_LIBRARY, ...this._getUserFunctions()].find(f => f.id === id);
        if (fn) this._insertFunction(fn);
      });
    });

    list.querySelectorAll('.fn-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this._deleteUserFunction(id);
      });
    });

    list.querySelectorAll('.fn-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this._openModal(id);
      });
    });
  }

  _cardHTML(fn) {
    const catColor = this._categoryColor(fn.category);
    const userActions = fn.isUser ? `
      <button class="fn-card-action fn-edit-btn" data-id="${fn.id}" title="Edit function">
        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9.5 1.5l3 3L4 13H1v-3L9.5 1.5z"/>
        </svg>
      </button>
      <button class="fn-card-action fn-delete-btn" data-id="${fn.id}" title="Delete function">
        <svg width="10" height="10" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="1" y1="1" x2="12" y2="12"/><line x1="12" y1="1" x2="1" y2="12"/>
        </svg>
      </button>` : '';

    return `
      <div class="fn-card" data-id="${fn.id}">
        <div class="fn-card-top">
          <div class="fn-card-info">
            <span class="fn-card-name">${this._escapeHtml(fn.name)}</span>
            <span class="fn-cat-badge" style="--cat-color:${catColor}">${this._escapeHtml(fn.category)}</span>
          </div>
          <div class="fn-card-actions">
            ${userActions}
            <button class="fn-insert-btn btn-run" data-id="${fn.id}" title="Insert at cursor">
              Insert
            </button>
          </div>
        </div>
        <div class="fn-card-sig">${this._escapeHtml(fn.signature)}</div>
        <div class="fn-card-desc">${this._escapeHtml(fn.description)}</div>
        ${fn.includes && fn.includes.length > 0 ? `
          <div class="fn-card-includes">
            ${fn.includes.map(inc => `<span class="fn-inc-tag">#include &lt;${this._escapeHtml(inc)}&gt;</span>`).join('')}
          </div>
        ` : ''}
      </div>`;
  }

  _updateTabUI() {
    document.querySelectorAll('.fn-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === this._activeTab);
    });
  }

  // ── Insert function into editor ────────────────────────────────────────────
  _insertFunction(fn) {
    if (!window.zenithEditor) return;

    // 1. Auto-add missing #includes
    if (fn.includes && fn.includes.length > 0) {
      for (const inc of fn.includes) {
        zenithEditor.addInclude(inc);
      }
    }

    // 2. Insert code at cursor
    zenithEditor.insertAtCursor('\n' + fn.code + '\n');

    // 3. Visual feedback
    this._showInsertToast(fn.name);
  }

  _showInsertToast(name) {
    if (window.showToast) {
      showToast(`${name}() inserted ✓`);
    }
  }

  // ── Custom function modal ──────────────────────────────────────────────────
  _openModal(editId = null) {
    this._editingId = editId;
    const titleEl = document.getElementById('fn-modal-title-text');
    const saveBtn = document.getElementById('btn-save-fn-modal');

    if (editId) {
      titleEl.textContent = 'Edit Custom Function';
      saveBtn.textContent = 'Save Changes';
      const fn = this._getUserFunctions().find(f => f.id === editId);
      if (fn) {
        document.getElementById('fn-input-name').value = fn.name || '';
        document.getElementById('fn-input-category').value = fn.category || 'My Functions';
        document.getElementById('fn-input-signature').value = fn.signature || '';
        document.getElementById('fn-input-description').value = fn.description || '';
        document.getElementById('fn-input-includes').value = (fn.includes || []).join(', ');
        document.getElementById('fn-input-code').value = fn.code || '';
      }
    } else {
      titleEl.textContent = 'Add Custom Function';
      saveBtn.textContent = 'Save Function';
      document.getElementById('fn-input-name').value = '';
      document.getElementById('fn-input-category').value = 'My Functions';
      document.getElementById('fn-input-signature').value = '';
      document.getElementById('fn-input-description').value = '';
      document.getElementById('fn-input-includes').value = '';
      document.getElementById('fn-input-code').value = '';
    }

    this._modal.classList.add('open');
    setTimeout(() => document.getElementById('fn-input-name')?.focus(), 100);
  }

  _closeModal() {
    this._modal.classList.remove('open');
    this._editingId = null;
  }

  _saveCustomFunction() {
    const name        = document.getElementById('fn-input-name').value.trim();
    const category    = document.getElementById('fn-input-category').value;
    const signature   = document.getElementById('fn-input-signature').value.trim();
    const description = document.getElementById('fn-input-description').value.trim();
    const includesRaw = document.getElementById('fn-input-includes').value.trim();
    const code        = document.getElementById('fn-input-code').value.trim();

    if (!name) { this._highlightError('fn-input-name', 'Function name is required'); return; }
    if (!code) { this._highlightError('fn-input-code', 'Function code is required'); return; }

    const includes = includesRaw
      ? includesRaw.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const userFns = this._getUserFunctions();

    if (this._editingId) {
      const idx = userFns.findIndex(f => f.id === this._editingId);
      if (idx !== -1) {
        userFns[idx] = { ...userFns[idx], name, category, signature: signature || name + '()', description, includes, code };
      }
    } else {
      const newFn = {
        id: 'user-' + Date.now(),
        category,
        name,
        signature: signature || name + '()',
        description: description || 'User-defined function',
        includes,
        code,
        isUser: true
      };
      userFns.push(newFn);
    }

    this._saveUserFunctions(userFns);
    this._closeModal();

    // Switch to My Functions tab to show the saved function
    this._activeTab = 'My Functions';
    this._renderList();

    if (window.showToast) showToast(`"${name}" saved ✓`);
  }

  _deleteUserFunction(id) {
    const fns = this._getUserFunctions().filter(f => f.id !== id);
    this._saveUserFunctions(fns);
    this._renderList();
    if (window.showToast) showToast('Function deleted');
  }

  _highlightError(inputId, msg) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.classList.add('fn-input-error');
    el.focus();
    el.placeholder = msg;
    setTimeout(() => { el.classList.remove('fn-input-error'); }, 2000);
  }

  // ── Utility ───────────────────────────────────────────────────────────────
  _categoryColor(cat) {
    const map = {
      'Math':                '#d4a017',
      'String':              '#7aab8a',
      'Sorting':             '#8fa8c8',
      'Searching':           '#3898ec',
      'Vector':              '#c96442',
      'Linked List':         '#a07840',
      'Graph':               '#9b7ec8',
      'Dynamic Programming': '#5a9e6f',
      'Bit Ops':             '#b54830',
      'My Functions':        '#c96442',
    };
    return map[cat] || '#87867f';
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// ── Export singleton ──────────────────────────────────────────────────────────
window.functionsPanel = new FunctionsPanel();
