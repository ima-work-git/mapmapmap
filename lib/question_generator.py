"""Question generation engine for decision trees."""


def get_best_question(candidates, decision_tree):
    """Get the most efficient distinguishing question from a decision tree.

    Returns the question that maximally splits the candidates.
    """
    if not decision_tree:
        return None

    return {
        'question': decision_tree.get('q', ''),
        'options': _extract_options(decision_tree),
    }


def _extract_options(tree):
    """Extract answer options from a decision tree node."""
    options = []

    if 'yes' in tree and 'no' in tree:
        yes_node = tree['yes']
        no_node = tree['no']
        options.append({
            'label': 'はい',
            'result': yes_node.get('result'),
            'result_label': yes_node.get('label'),
            'next': yes_node if 'q' in yes_node else None,
        })
        options.append({
            'label': 'いいえ',
            'result': no_node.get('result'),
            'result_label': no_node.get('label'),
            'next': no_node if 'q' in no_node else None,
        })
    elif 'options' in tree:
        for key, node in tree['options'].items():
            options.append({
                'label': key,
                'result': node.get('result'),
                'result_label': node.get('label'),
                'next': node if 'q' in node else None,
            })

    return options


def navigate_tree(tree, answer):
    """Navigate decision tree with an answer, return next node or result."""
    if 'yes' in tree and 'no' in tree:
        if answer in ('はい', 'yes', True):
            return tree['yes']
        else:
            return tree['no']
    elif 'options' in tree:
        return tree['options'].get(answer, {})
    return {}
