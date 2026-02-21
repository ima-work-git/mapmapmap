/**
 * Question Engine - Decision tree traversal for candidate narrowing
 */
window.QuestionEngine = (function() {
  let currentTree = null;
  let currentNode = null;
  let history = [];

  function setTree(tree) {
    currentTree = tree;
    currentNode = tree;
    history = [];
  }

  function getCurrentQuestion() {
    if (!currentNode || !currentNode.q) return null;
    return {
      question: currentNode.q,
      options: extractOptions(currentNode),
    };
  }

  function answer(answerLabel) {
    if (!currentNode) return null;

    history.push({ node: currentNode, answer: answerLabel });

    let next = null;

    // Yes/No tree
    if ('yes' in currentNode && 'no' in currentNode) {
      if (answerLabel === 'はい') {
        next = currentNode.yes;
      } else {
        next = currentNode.no;
      }
    }
    // Options tree
    else if ('options' in currentNode) {
      next = currentNode.options[answerLabel];
    }

    if (!next) return null;

    // If result found
    if (next.result) {
      currentNode = null;
      return { type: 'result', result: next.result, label: next.label };
    }

    // If next question
    if (next.q) {
      currentNode = next;
      return { type: 'question', question: getCurrentQuestion() };
    }

    return null;
  }

  function extractOptions(node) {
    const opts = [];

    if ('yes' in node && 'no' in node) {
      opts.push({
        label: 'はい',
        result: node.yes.result || null,
        resultLabel: node.yes.label || null,
        hasNext: !!node.yes.q,
      });
      opts.push({
        label: 'いいえ',
        result: node.no.result || null,
        resultLabel: node.no.label || null,
        hasNext: !!node.no.q,
      });
    } else if ('options' in node) {
      for (const [key, val] of Object.entries(node.options)) {
        opts.push({
          label: key,
          result: val.result || null,
          resultLabel: val.label || null,
          hasNext: !!val.q,
        });
      }
    }

    return opts;
  }

  function reset() {
    currentNode = currentTree;
    history = [];
  }

  function getHistory() { return history; }

  return { setTree, getCurrentQuestion, answer, reset, getHistory };
})();
