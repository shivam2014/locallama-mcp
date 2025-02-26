# Comprehensive Benchmark Results: Local LLMs vs OpenRouter Models

*Generated on: 2025-02-26T07:18:46.327Z*

## Overview

This report compares the performance of local LM Studio models against various models available through OpenRouter for coding tasks.

## Tasks

### simple-function

**Description:** Write a JavaScript function that calculates the factorial of a number.

**Complexity:** 0.2

### medium-algorithm

**Description:** Implement a binary search algorithm in JavaScript with proper error handling and edge cases.

**Complexity:** 0.5

### complex-design-pattern

**Description:** Implement a TypeScript class that uses the Observer design pattern for a pub/sub event system with strong typing.

**Complexity:** 0.8

## Results for simple-function

### LM Studio Models

| Model | Time (ms) | Success Rate | Quality Score |
|-------|-----------|--------------|---------------|
| stable-code-instruct-3b | 2622 | 1.00 | 0.85 |
| qwen2.5-coder-3b-instruct | 3917 | 1.00 | 0.85 |
| tinycodellama-1.3b-5k | 8649 | 1.00 | 0.76 |
| qwen2.5-coder-1.5b-instruct | 6224 | 1.00 | 0.85 |
| deepseek-r1-distill-qwen-1.5b | 7366 | 1.00 | 0.85 |
| qwen2.5-7b-instruct-1m | 31026 | 1.00 | 0.85 |
| deepseek-r1-distill-qwen-7b | 60011 | 0.00 | 0.36 |
| deepseek-r1-distill-llama-8b-abliterated | 60009 | 0.00 | 0.36 |

### OpenRouter Models

| Model | Time (ms) | Success Rate | Quality Score |
|-------|-----------|--------------|---------------|
| anthropic/claude-3-opus-20240229 | 19515 | 1.00 | 0.85 |
| anthropic/claude-3-sonnet-20240229 | 7320 | 1.00 | 0.85 |
| anthropic/claude-3-haiku-20240307 | 93 | 0.00 | 0.36 |
| google/gemini-1.5-pro-latest | 93 | 0.00 | 0.36 |
| meta-llama/llama-3-70b-instruct | 6108 | 1.00 | 0.85 |
| mistralai/mistral-large-latest | 87 | 0.00 | 0.36 |
| openai/gpt-4o | 8229 | 1.00 | 0.85 |
| openai/gpt-3.5-turbo | 1330 | 1.00 | 0.85 |

### Sample Outputs

#### LM Studio: stable-code-instruct-3b

```
Here is a simple JavaScript function that calculates the factorial of a number using recursion:

```javascript
function factorial(n) {
    if (n === 0 || n === 1)
        return 1;
    else
        return n * factorial(n - 1);
}
```

You can call this function with an integer argument to get its factorial. For example, `factorial(5)` would return `120`.

This function uses recursion to calculate the factorial of a number. It keeps calling itself with smaller and smaller values until it reaches the base case where `n` is 0 or 1. At this point, the function returns 1 because the factorial of 0 and 1 is defined as 1.

In the general case, the function multiplies the current value of `n` by the factorial of `n - 1`. This continues until the base case is reached.
```

#### OpenRouter: anthropic/claude-3-opus-20240229

```
Certainly! Here's a JavaScript function that calculates the factorial of a number:

```javascript
function factorial(num) {
  if (num < 0) {
    return undefined;
  }
  
  if (num === 0 || num === 1) {
    return 1;
  }
  
  let result = 1;
  for (let i = 2; i <= num; i++) {
    result *= i;
  }
  
  return result;
}
```

Explanation:

1. The function takes a single parameter `num`, which represents the number for which we want to calculate the factorial.

2. We first check if `num` is less than 0. If it is, we return `undefined` since the factorial is not defined for negative numbers.

3. Next, we check if `num` is equal to 0 or 1. If it is, we return 1 since the factorial of 0 and 1 is defined as 1.

4. If `num` is greater than 1, we initialize a variable `result` to 1. This will store the factorial value as we multiply it by each number from 2 to `num`.

5. We use a `for` loop to iterate from 2 to `num`. In each iteration, we multiply `result` by the current value of `i`. This effec...
```

## Results for medium-algorithm

### LM Studio Models

| Model | Time (ms) | Success Rate | Quality Score |
|-------|-----------|--------------|---------------|
| stable-code-instruct-3b | 5238 | 1.00 | 0.85 |
| qwen2.5-coder-3b-instruct | 7541 | 1.00 | 0.85 |
| tinycodellama-1.3b-5k | 3483 | 1.00 | 0.81 |
| qwen2.5-coder-1.5b-instruct | 1910 | 1.00 | 0.85 |
| deepseek-r1-distill-qwen-1.5b | 8843 | 1.00 | 0.85 |
| qwen2.5-7b-instruct-1m | 50218 | 1.00 | 0.85 |
| deepseek-r1-distill-qwen-7b | 60012 | 0.00 | 0.36 |
| deepseek-r1-distill-llama-8b-abliterated | 60016 | 0.00 | 0.36 |

### OpenRouter Models

| Model | Time (ms) | Success Rate | Quality Score |
|-------|-----------|--------------|---------------|
| anthropic/claude-3-opus-20240229 | 29174 | 1.00 | 0.85 |
| anthropic/claude-3-sonnet-20240229 | 16392 | 1.00 | 0.85 |
| anthropic/claude-3-haiku-20240307 | 86 | 0.00 | 0.36 |
| google/gemini-1.5-pro-latest | 103 | 0.00 | 0.36 |
| meta-llama/llama-3-70b-instruct | 21685 | 1.00 | 0.85 |
| mistralai/mistral-large-latest | 94 | 0.00 | 0.36 |
| openai/gpt-4o | 16401 | 1.00 | 0.85 |
| openai/gpt-3.5-turbo | 4378 | 1.00 | 0.85 |

### Sample Outputs

#### LM Studio: stable-code-instruct-3b

```
Here is an implementation of a binary search algorithm in JavaScript:

```javascript
function binarySearch(arr, target) {
  if (!Array.isArray(arr)) {
    throw new Error("First argument must be an array.");
  }

  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2));

    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  throw new Error("Target not found in array."));
}
```

To use this function, you can call it with an array and a target value like this:

```javascript
const arr = [1, 2, 3, 4, 5];
const target = 3;

try {
  const index = binarySearch(arr, target));
  console.log(`Target ${target} found at index ${index}.`));
} catch (error) {
  console.error(error);
}
```

This will output: `Target 3 found at index 2.`

Note that the function assumes the input array is sorted in ascending order, as binary search relies...
```

#### OpenRouter: anthropic/claude-3-opus-20240229

```
Certainly! Here's an implementation of a binary search algorithm in JavaScript with proper error handling and edge cases:

```javascript
function binarySearch(arr, target) {
  // Check if the array is empty
  if (arr.length === 0) {
    throw new Error("Array is empty");
  }

  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);

    // Check if the middle element is the target
    if (arr[mid] === target) {
      return mid;
    }

    // If the target is smaller, search in the left half
    if (target < arr[mid]) {
      right = mid - 1;
    }
    // If the target is larger, search in the right half
    else {
      left = mid + 1;
    }
  }

  // Target not found
  return -1;
}

// Example usage
const arr = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

try {
  const target1 = 7;
  const index1 = binarySearch(arr, target1);
  console.log(`Index of ${target1}: ${index1}`);

  const target2 = 20;
  const index2 = binarySearch(a...
```

## Results for complex-design-pattern

### LM Studio Models

| Model | Time (ms) | Success Rate | Quality Score |
|-------|-----------|--------------|---------------|
| stable-code-instruct-3b | 6302 | 1.00 | 0.85 |
| qwen2.5-coder-3b-instruct | 6747 | 1.00 | 0.85 |
| tinycodellama-1.3b-5k | 6129 | 1.00 | 0.79 |
| qwen2.5-coder-1.5b-instruct | 1541 | 1.00 | 0.85 |
| deepseek-r1-distill-qwen-1.5b | 8771 | 1.00 | 0.85 |
| qwen2.5-7b-instruct-1m | 60014 | 0.00 | 0.36 |
| deepseek-r1-distill-qwen-7b | 60015 | 0.00 | 0.36 |
| deepseek-r1-distill-llama-8b-abliterated | 60015 | 0.00 | 0.36 |

### OpenRouter Models

| Model | Time (ms) | Success Rate | Quality Score |
|-------|-----------|--------------|---------------|
| anthropic/claude-3-opus-20240229 | 28461 | 1.00 | 0.85 |
| anthropic/claude-3-sonnet-20240229 | 11107 | 1.00 | 0.85 |
| anthropic/claude-3-haiku-20240307 | 89 | 0.00 | 0.36 |
| google/gemini-1.5-pro-latest | 85 | 0.00 | 0.36 |
| meta-llama/llama-3-70b-instruct | 9395 | 1.00 | 0.85 |
| mistralai/mistral-large-latest | 96 | 0.00 | 0.36 |
| openai/gpt-4o | 14975 | 1.00 | 0.85 |
| openai/gpt-3.5-turbo | 4180 | 1.00 | 0.85 |

### Sample Outputs

#### LM Studio: stable-code-instruct-3b

```
```typescript
// Define an interface for observers
interface Observer {
  update(eventData: any): void;
}

export class EventSystem {
  private _observers: Observer[] = [];

  public subscribe(observer: Observer): void {
    if (!this._observers.some((item) => item === observer)))) {
      this._observers.push(observer);
    } else {
      throw new Error("An observer with the same ID already exists.");
    }
  }

  public unsubscribe(observer: Observer): void {
    const index = this._observers.findIndex((item) => item === observer));
    if (index !== -1) {
      this._observers.splice(index, 1);
    } else {
      throw new Error("No observer with the same ID exists.");
    }
  }

  public publish(eventData: any): void {
    this._observers.forEach((observer) => observer.update(eventData)));
  }
}

export class MyObserver implements Observer {
  private _id: number;

  constructor(id: number) {
    this._id = id;
  }

  public get id(): number {
    return this._id;
  }

  public up...
```

#### OpenRouter: anthropic/claude-3-opus-20240229

```
Certainly! Here's an implementation of a TypeScript class that uses the Observer design pattern for a pub/sub event system with strong typing:

```typescript
interface Subscriber<T> {
  update(data: T): void;
}

class EventEmitter<T> {
  private subscribers: Subscriber<T>[] = [];

  subscribe(subscriber: Subscriber<T>): void {
    this.subscribers.push(subscriber);
  }

  unsubscribe(subscriber: Subscriber<T>): void {
    const index = this.subscribers.indexOf(subscriber);
    if (index !== -1) {
      this.subscribers.splice(index, 1);
    }
  }

  emit(data: T): void {
    for (const subscriber of this.subscribers) {
      subscriber.update(data);
    }
  }
}

// Example usage
class Logger implements Subscriber<string> {
  update(data: string): void {
    console.log(`Received data: ${data}`);
  }
}

class Processor implements Subscriber<number> {
  update(data: number): void {
    console.log(`Processing data: ${data}`);
  }
}

const stringEmitter = new EventEmitter<string>();
const...
```

## Recommendations

Based on these benchmark results, the following recommendations can be made:

1. For simple coding tasks, consider using [best local model for simple tasks] as it provides the best balance of performance and quality.

2. For complex tasks where quality is critical, [best OpenRouter model for complex tasks] performs well.

3. When response time is the priority, [fastest model] offers significantly faster responses.

4. For cost-sensitive applications with high usage volume, using local LLMs can result in significant cost savings.

