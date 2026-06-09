function repairJSON(jsonStr) {
  let repaired = jsonStr.trim();
  if (!repaired) return '{}';
  
  let inString = false;
  let isEscaped = false;
  let stack = [];
  
  for (let i = 0; i < repaired.length; i++) {
    let char = repaired[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        stack.push('}');
      } else if (char === '[') {
        stack.push(']');
      } else if (char === '}') {
        if (stack[stack.length - 1] === '}') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack[stack.length - 1] === ']') {
          stack.pop();
        }
      }
    }
  }
  
  if (inString) {
    if (isEscaped) {
      repaired = repaired.slice(0, -1);
    }
    repaired += '"';
  }
  
  while (stack.length > 0) {
    repaired += stack.pop();
  }
  
  return repaired;
}

const incompleteJSON = `{
  "type": "interactive_simulator",
  "topic": "Monohybrid Cross Simulator",
  "htmlCode": "<div>hi</div>",
  "cssCode": "body { color: red; }",
  "jsCode": "console.log('hi');",
  "explanation": "Explore the inheritance of a single trait (Pea Plant`;

console.log(repairJSON(incompleteJSON));
console.log(JSON.parse(repairJSON(incompleteJSON)));
