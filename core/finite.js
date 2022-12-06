function test(string) {
  let i;
  let startIndex;
  let endIndex;
  let result = []
  // 状态机应返回下一个状态
  const waitForA = char => {
    if (char === 'a') {
      startIndex = i;
      return waitForB;
    }
    return waitForA;
  };
  const waitForB = char => {
    if (char === 'b') {
      return waitForC;
    }
    return waitForA;
  };
  const waitForC = char => {
    if (char === 'c' || char === 'd') {
      endIndex = i;
      return end;
    }
    return waitForC;
  };
  const end = () => {
    return end;
  };
  let currentState = waitForA; // 初始状态还是等待A
  for (i = 0; i < string.length; i++) {
    let nextState = currentState(string[i]);
    currentState = nextState;
    if (currentState === end) {
      result.push({
        start: startIndex,
        end: endIndex
      })
      currentState = waitForA;
    }
  }
  console.info(result);
}

console.info(test('ajskdajskldajskabcalksdjaskldjaskldjkabc'));
