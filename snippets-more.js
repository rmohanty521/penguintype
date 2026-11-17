// Java, Go and Rust versions of the algorithms, merged into ALGOS by id.
// Same rule as snippets.js: no backticks or "${" inside snippets.
const MORE_ALGOS = {
  'binary-search': {
    java: String.raw`
public static int binarySearch(int[] arr, int target) {
    int lo = 0, hi = arr.length - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}`,
    go: String.raw`
func binarySearch(arr []int, target int) int {
    lo, hi := 0, len(arr)-1
    for lo <= hi {
        mid := lo + (hi-lo)/2
        if arr[mid] == target {
            return mid
        }
        if arr[mid] < target {
            lo = mid + 1
        } else {
            hi = mid - 1
        }
    }
    return -1
}`,
    rust: String.raw`
fn binary_search(arr: &[i32], target: i32) -> Option<usize> {
    let (mut lo, mut hi) = (0, arr.len());
    while lo < hi {
        let mid = lo + (hi - lo) / 2;
        if arr[mid] == target {
            return Some(mid);
        }
        if arr[mid] < target {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }
    None
}`,
  },
  'bubble-sort': {
    java: String.raw`
public static void bubbleSort(int[] arr) {
    int n = arr.length;
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                int tmp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = tmp;
            }
        }
    }
}`,
    go: String.raw`
func bubbleSort(arr []int) {
    n := len(arr)
    for i := 0; i < n; i++ {
        for j := 0; j < n-i-1; j++ {
            if arr[j] > arr[j+1] {
                arr[j], arr[j+1] = arr[j+1], arr[j]
            }
        }
    }
}`,
    rust: String.raw`
fn bubble_sort(arr: &mut [i32]) {
    let n = arr.len();
    for i in 0..n {
        for j in 0..n - i - 1 {
            if arr[j] > arr[j + 1] {
                arr.swap(j, j + 1);
            }
        }
    }
}`,
  },
  quicksort: {
    java: String.raw`
public static void quicksort(int[] arr, int lo, int hi) {
    if (lo >= hi) return;
    int pivot = arr[hi];
    int i = lo;
    for (int j = lo; j < hi; j++) {
        if (arr[j] < pivot) {
            int tmp = arr[i];
            arr[i++] = arr[j];
            arr[j] = tmp;
        }
    }
    arr[hi] = arr[i];
    arr[i] = pivot;
    quicksort(arr, lo, i - 1);
    quicksort(arr, i + 1, hi);
}`,
    go: String.raw`
func quicksort(arr []int) {
    if len(arr) < 2 {
        return
    }
    pivot := arr[len(arr)-1]
    i := 0
    for j := 0; j < len(arr)-1; j++ {
        if arr[j] < pivot {
            arr[i], arr[j] = arr[j], arr[i]
            i++
        }
    }
    arr[i], arr[len(arr)-1] = arr[len(arr)-1], arr[i]
    quicksort(arr[:i])
    quicksort(arr[i+1:])
}`,
    rust: String.raw`
fn quicksort(arr: &mut [i32]) {
    if arr.len() < 2 {
        return;
    }
    let last = arr.len() - 1;
    let mut i = 0;
    for j in 0..last {
        if arr[j] < arr[last] {
            arr.swap(i, j);
            i += 1;
        }
    }
    arr.swap(i, last);
    let (left, right) = arr.split_at_mut(i);
    quicksort(left);
    quicksort(&mut right[1..]);
}`,
  },
  'merge-sort': {
    java: String.raw`
public static int[] mergeSort(int[] arr) {
    if (arr.length <= 1) return arr;
    int mid = arr.length / 2;
    int[] left = mergeSort(Arrays.copyOfRange(arr, 0, mid));
    int[] right = mergeSort(Arrays.copyOfRange(arr, mid, arr.length));
    int[] result = new int[arr.length];
    int i = 0, j = 0, k = 0;
    while (i < left.length && j < right.length) {
        result[k++] = left[i] <= right[j] ? left[i++] : right[j++];
    }
    while (i < left.length) result[k++] = left[i++];
    while (j < right.length) result[k++] = right[j++];
    return result;
}`,
    go: String.raw`
func mergeSort(arr []int) []int {
    if len(arr) <= 1 {
        return arr
    }
    mid := len(arr) / 2
    left := mergeSort(arr[:mid])
    right := mergeSort(arr[mid:])
    result := make([]int, 0, len(arr))
    i, j := 0, 0
    for i < len(left) && j < len(right) {
        if left[i] <= right[j] {
            result = append(result, left[i])
            i++
        } else {
            result = append(result, right[j])
            j++
        }
    }
    result = append(result, left[i:]...)
    return append(result, right[j:]...)
}`,
    rust: String.raw`
fn merge_sort(arr: &[i32]) -> Vec<i32> {
    if arr.len() <= 1 {
        return arr.to_vec();
    }
    let mid = arr.len() / 2;
    let left = merge_sort(&arr[..mid]);
    let right = merge_sort(&arr[mid..]);
    let mut result = Vec::with_capacity(arr.len());
    let (mut i, mut j) = (0, 0);
    while i < left.len() && j < right.len() {
        if left[i] <= right[j] {
            result.push(left[i]);
            i += 1;
        } else {
            result.push(right[j]);
            j += 1;
        }
    }
    result.extend_from_slice(&left[i..]);
    result.extend_from_slice(&right[j..]);
    result
}`,
  },
  bfs: {
    java: String.raw`
public static List<Integer> bfs(List<List<Integer>> graph, int start) {
    boolean[] visited = new boolean[graph.size()];
    Queue<Integer> queue = new ArrayDeque<>();
    List<Integer> order = new ArrayList<>();
    visited[start] = true;
    queue.add(start);
    while (!queue.isEmpty()) {
        int node = queue.poll();
        order.add(node);
        for (int neighbor : graph.get(node)) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;
                queue.add(neighbor);
            }
        }
    }
    return order;
}`,
    go: String.raw`
func bfs(graph [][]int, start int) []int {
    visited := make([]bool, len(graph))
    queue := []int{start}
    order := []int{}
    visited[start] = true
    for len(queue) > 0 {
        node := queue[0]
        queue = queue[1:]
        order = append(order, node)
        for _, neighbor := range graph[node] {
            if !visited[neighbor] {
                visited[neighbor] = true
                queue = append(queue, neighbor)
            }
        }
    }
    return order
}`,
    rust: String.raw`
use std::collections::VecDeque;

fn bfs(graph: &Vec<Vec<usize>>, start: usize) -> Vec<usize> {
    let mut visited = vec![false; graph.len()];
    let mut queue = VecDeque::from([start]);
    let mut order = Vec::new();
    visited[start] = true;
    while let Some(node) = queue.pop_front() {
        order.push(node);
        for &neighbor in &graph[node] {
            if !visited[neighbor] {
                visited[neighbor] = true;
                queue.push_back(neighbor);
            }
        }
    }
    order
}`,
  },
  dfs: {
    java: String.raw`
public static void dfs(List<List<Integer>> graph, int node, boolean[] visited) {
    visited[node] = true;
    for (int neighbor : graph.get(node)) {
        if (!visited[neighbor]) dfs(graph, neighbor, visited);
    }
}`,
    go: String.raw`
func dfs(graph [][]int, node int, visited []bool) {
    visited[node] = true
    for _, neighbor := range graph[node] {
        if !visited[neighbor] {
            dfs(graph, neighbor, visited)
        }
    }
}`,
    rust: String.raw`
fn dfs(graph: &Vec<Vec<usize>>, node: usize, visited: &mut Vec<bool>) {
    visited[node] = true;
    for &neighbor in &graph[node] {
        if !visited[neighbor] {
            dfs(graph, neighbor, visited);
        }
    }
}`,
  },
  'two-sum': {
    java: String.raw`
public static int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int diff = target - nums[i];
        if (seen.containsKey(diff)) return new int[] {seen.get(diff), i};
        seen.put(nums[i], i);
    }
    return new int[0];
}`,
    go: String.raw`
func twoSum(nums []int, target int) []int {
    seen := map[int]int{}
    for i, num := range nums {
        if j, ok := seen[target-num]; ok {
            return []int{j, i}
        }
        seen[num] = i
    }
    return nil
}`,
    rust: String.raw`
use std::collections::HashMap;

fn two_sum(nums: &[i32], target: i32) -> Option<(usize, usize)> {
    let mut seen = HashMap::new();
    for (i, &num) in nums.iter().enumerate() {
        if let Some(&j) = seen.get(&(target - num)) {
            return Some((j, i));
        }
        seen.insert(num, i);
    }
    None
}`,
  },
  fibonacci: {
    java: String.raw`
public static long fibonacci(int n) {
    if (n < 2) return n;
    long a = 0, b = 1;
    for (int i = 1; i < n; i++) {
        long c = a + b;
        a = b;
        b = c;
    }
    return b;
}`,
    go: String.raw`
func fibonacci(n int) int {
    if n < 2 {
        return n
    }
    a, b := 0, 1
    for i := 1; i < n; i++ {
        a, b = b, a+b
    }
    return b
}`,
    rust: String.raw`
fn fibonacci(n: u32) -> u64 {
    if n < 2 {
        return n as u64;
    }
    let (mut a, mut b) = (0u64, 1u64);
    for _ in 1..n {
        let c = a + b;
        a = b;
        b = c;
    }
    b
}`,
  },
  'reverse-linked-list': {
    java: String.raw`
public static ListNode reverseList(ListNode head) {
    ListNode prev = null;
    ListNode curr = head;
    while (curr != null) {
        ListNode next = curr.next;
        curr.next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}`,
    go: String.raw`
func reverseList(head *ListNode) *ListNode {
    var prev *ListNode
    curr := head
    for curr != nil {
        next := curr.Next
        curr.Next = prev
        prev = curr
        curr = next
    }
    return prev
}`,
    rust: String.raw`
fn reverse_list(head: Option<Box<ListNode>>) -> Option<Box<ListNode>> {
    let mut prev = None;
    let mut curr = head;
    while let Some(mut node) = curr {
        curr = node.next.take();
        node.next = prev;
        prev = Some(node);
    }
    prev
}`,
  },
  sieve: {
    java: String.raw`
public static List<Integer> sieve(int n) {
    boolean[] composite = new boolean[n + 1];
    List<Integer> primes = new ArrayList<>();
    for (int i = 2; i <= n; i++) {
        if (composite[i]) continue;
        primes.add(i);
        for (long j = (long) i * i; j <= n; j += i) composite[(int) j] = true;
    }
    return primes;
}`,
    go: String.raw`
func sieve(n int) []int {
    composite := make([]bool, n+1)
    primes := []int{}
    for i := 2; i <= n; i++ {
        if composite[i] {
            continue
        }
        primes = append(primes, i)
        for j := i * i; j <= n; j += i {
            composite[j] = true
        }
    }
    return primes
}`,
    rust: String.raw`
fn sieve(n: usize) -> Vec<usize> {
    let mut composite = vec![false; n + 1];
    let mut primes = Vec::new();
    for i in 2..=n {
        if composite[i] {
            continue;
        }
        primes.push(i);
        for j in (i * i..=n).step_by(i) {
            composite[j] = true;
        }
    }
    primes
}`,
  },
};
for (const a of ALGOS) Object.assign(a.code, MORE_ALGOS[a.id]);

// Everyday code (not algorithms), only used in random mode. Ids must be unique within a language.
const MISC = {
  python: [
    { id: 'word-count', name: 'word count', code: String.raw`
from collections import Counter

def top_words(path, n=10):
    with open(path, encoding="utf-8") as f:
        words = f.read().lower().split()
    return Counter(words).most_common(n)` },
    { id: 'dataclass', name: 'dataclass', code: String.raw`
from dataclasses import dataclass, field

@dataclass
class Player:
    name: str
    score: int = 0
    items: list[str] = field(default_factory=list)

    def add_item(self, item):
        self.items.append(item)
        self.score += 10` },
    { id: 'timer-decorator', name: 'timer decorator', code: String.raw`
import time
from functools import wraps

def timed(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = fn(*args, **kwargs)
        print(f"{fn.__name__} took {time.perf_counter() - start:.3f}s")
        return result
    return wrapper` },
    { id: 'fetch-json', name: 'fetch json', code: String.raw`
import requests

def get_user(user_id):
    response = requests.get(f"https://api.example.com/users/{user_id}", timeout=5)
    response.raise_for_status()
    data = response.json()
    return {"name": data["name"], "email": data["email"]}` },
    { id: 'cli', name: 'command line tool', code: String.raw`
import argparse

def main():
    parser = argparse.ArgumentParser(description="Greet someone")
    parser.add_argument("name")
    parser.add_argument("--times", type=int, default=1)
    args = parser.parse_args()
    for _ in range(args.times):
        print(f"Hello, {args.name}!")

if __name__ == "__main__":
    main()` },
  ],
  javascript: [
    { id: 'debounce', name: 'debounce', code: String.raw`
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}` },
    { id: 'fetch-json', name: 'fetch json', code: String.raw`
async function getUser(id) {
  const res = await fetch("https://api.example.com/users/" + id);
  if (!res.ok) throw new Error("Request failed: " + res.status);
  const data = await res.json();
  return { name: data.name, email: data.email };
}` },
    { id: 'group-by', name: 'group by', code: String.raw`
const groupBy = (items, key) =>
  items.reduce((groups, item) => {
    const value = item[key];
    (groups[value] ||= []).push(item);
    return groups;
  }, {});` },
    { id: 'event-emitter', name: 'event emitter', code: String.raw`
class Emitter {
  constructor() {
    this.listeners = {};
  }

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
  }

  emit(event, ...args) {
    for (const fn of this.listeners[event] || []) fn(...args);
  }
}` },
    { id: 'express-api', name: 'express api', code: String.raw`
const express = require("express");
const app = express();
const todos = [];

app.use(express.json());

app.get("/api/todos", (req, res) => {
  res.json(todos);
});

app.post("/api/todos", (req, res) => {
  const todo = { id: Date.now(), text: req.body.text, done: false };
  todos.push(todo);
  res.status(201).json(todo);
});

app.listen(3000);` },
  ],
  cpp: [
    { id: 'count-lines', name: 'count lines', code: String.raw`
#include <fstream>
#include <iostream>
#include <string>

int main() {
    std::ifstream file("input.txt");
    std::string line;
    int count = 0;
    while (std::getline(file, line)) {
        if (!line.empty()) count++;
    }
    std::cout << "lines: " << count << std::endl;
    return 0;
}` },
    { id: 'sort-structs', name: 'sort structs', code: String.raw`
struct Student {
    std::string name;
    int grade;
};

void sortByGrade(std::vector<Student>& students) {
    std::sort(students.begin(), students.end(), [](const Student& a, const Student& b) {
        return a.grade > b.grade;
    });
}` },
    { id: 'counter-class', name: 'counter class', code: String.raw`
class Counter {
public:
    explicit Counter(int start = 0) : value(start) {}

    void increment() { value++; }
    int get() const { return value; }

private:
    int value;
};` },
    { id: 'word-frequency', name: 'word frequency', code: String.raw`
std::map<std::string, int> wordFrequency(const std::string& text) {
    std::map<std::string, int> freq;
    std::istringstream stream(text);
    std::string word;
    while (stream >> word) {
        freq[word]++;
    }
    return freq;
}` },
    { id: 'clamp-template', name: 'clamp template', code: String.raw`
template <typename T>
T clamp(T value, T low, T high) {
    if (value < low) return low;
    if (value > high) return high;
    return value;
}` },
  ],
  java: [
    { id: 'stream-revenue', name: 'stream revenue', code: String.raw`
record Order(String customer, double total) {}

double revenueFor(List<Order> orders, String customer) {
    return orders.stream()
        .filter(o -> o.customer().equals(customer))
        .mapToDouble(Order::total)
        .sum();
}` },
    { id: 'bank-account', name: 'bank account', code: String.raw`
public class BankAccount {
    private double balance;

    public void deposit(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
        balance += amount;
    }

    public double getBalance() {
        return balance;
    }
}` },
    { id: 'read-file', name: 'read file', code: String.raw`
try (BufferedReader reader = Files.newBufferedReader(Path.of("data.txt"))) {
    String line;
    while ((line = reader.readLine()) != null) {
        System.out.println(line.trim());
    }
} catch (IOException e) {
    System.err.println("could not read file: " + e.getMessage());
}` },
    { id: 'hello-input', name: 'hello input', code: String.raw`
public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = scanner.nextLine();
        System.out.println("Hello, " + name + "!");
    }
}` },
    { id: 'shape-interface', name: 'shape interface', code: String.raw`
interface Shape {
    double area();
}

class Circle implements Shape {
    private final double radius;

    Circle(double radius) {
        this.radius = radius;
    }

    public double area() {
        return Math.PI * radius * radius;
    }
}` },
  ],
  go: [
    { id: 'http-handler', name: 'http handler', code: String.raw`
func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func main() {
    http.HandleFunc("/health", healthHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}` },
    { id: 'struct-method', name: 'struct method', code: String.raw`
type Rectangle struct {
    Width, Height float64
}

func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}` },
    { id: 'waitgroup', name: 'waitgroup', code: String.raw`
func fetchAll(urls []string) {
    var wg sync.WaitGroup
    for _, url := range urls {
        wg.Add(1)
        go func(u string) {
            defer wg.Done()
            resp, err := http.Get(u)
            if err != nil {
                log.Println(err)
                return
            }
            resp.Body.Close()
        }(url)
    }
    wg.Wait()
}` },
    { id: 'read-config', name: 'read config', code: String.raw`
func readConfig(path string) (Config, error) {
    var cfg Config
    data, err := os.ReadFile(path)
    if err != nil {
        return cfg, fmt.Errorf("read config: %w", err)
    }
    err = json.Unmarshal(data, &cfg)
    return cfg, err
}` },
    { id: 'channel-producer', name: 'channel producer', code: String.raw`
func producer(n int) <-chan int {
    ch := make(chan int)
    go func() {
        defer close(ch)
        for i := 0; i < n; i++ {
            ch <- i * i
        }
    }()
    return ch
}` },
  ],
  rust: [
    { id: 'struct-impl', name: 'struct impl', code: String.raw`
struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    fn area(&self) -> f64 {
        self.width * self.height
    }

    fn is_square(&self) -> bool {
        self.width == self.height
    }
}` },
    { id: 'enum-match', name: 'enum match', code: String.raw`
enum Command {
    Move { x: i32, y: i32 },
    Say(String),
    Quit,
}

fn run(cmd: Command) {
    match cmd {
        Command::Move { x, y } => println!("moving to {}, {}", x, y),
        Command::Say(text) => println!("{}", text),
        Command::Quit => println!("bye"),
    }
}` },
    { id: 'count-lines', name: 'count lines', code: String.raw`
use std::fs;
use std::io;

fn count_lines(path: &str) -> io::Result<usize> {
    let text = fs::read_to_string(path)?;
    Ok(text.lines().filter(|line| !line.trim().is_empty()).count())
}` },
    { id: 'iterator-chain', name: 'iterator chain', code: String.raw`
fn sum_of_even_squares(nums: &[i32]) -> i32 {
    nums.iter()
        .filter(|&&n| n % 2 == 0)
        .map(|&n| n * n)
        .sum()
}` },
    { id: 'trait', name: 'trait', code: String.raw`
trait Describe {
    fn describe(&self) -> String;
}

struct Dog {
    name: String,
}

impl Describe for Dog {
    fn describe(&self) -> String {
        format!("{} is a good dog", self.name)
    }
}` },
  ],
};
