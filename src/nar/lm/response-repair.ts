export function repairParentheses(text: string): string {
	let openCount = 0;
	let result = text;
	
	for (const char of text) {
		if (char === '(') openCount++;
		else if (char === ')') openCount--;
	}
	
	if (openCount > 0) {
		result += ')'.repeat(openCount);
	} else if (openCount < 0) {
		const openParens = '('.repeat(-openCount);
		result = openParens + text;
	}
	
	return result;
}

export function stripMarkdown(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, (match) => {
			return match.replace(/```/g, '').trim();
		})
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1');
}

export function fixUnquotedArguments(text: string): string {
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) return text;
	
	let jsonStr = jsonMatch[0];
	
	jsonStr = jsonStr.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
	
	jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ': "$1"');
	jsonStr = jsonStr.replace(/:\s*([a-zA-Z0-9_]+)([\s,}])/g, ': "$1"$2');
	
	return text.replace(jsonMatch[0], jsonStr);
}

export function repairTruncatedJSON(text: string): string {
	const jsonMatch = text.match(/\{[\s\S]*/);
	if (!jsonMatch) return text;
	
	let jsonStr = jsonMatch[0];
	
	const openBraces = (jsonStr.match(/\{/g) || []).length;
	const closeBraces = (jsonStr.match(/\}/g) || []).length;
	
	if (openBraces > closeBraces) {
		jsonStr += '}'.repeat(openBraces - closeBraces);
	}
	
	const openBrackets = (jsonStr.match(/\[/g) || []).length;
	const closeBrackets = (jsonStr.match(/\]/g) || []).length;
	
	if (openBrackets > closeBrackets) {
		jsonStr += ']'.repeat(openBrackets - closeBrackets);
	}
	
	if (jsonStr.endsWith(',')) {
		jsonStr = jsonStr.slice(0, -1) + '}';
	}
	
	if (jsonStr.match(/:\s*$/)) {
		jsonStr += '""}';
	}
	
	return text.replace(jsonMatch[0], jsonStr);
}

export function repairResponse(text: string, contentType: 'json' | 'narsese' | 'markdown' = 'json'): string {
	let repaired = text;
	
	if (contentType === 'json' || contentType === 'narsese') {
		repaired = stripMarkdown(repaired);
	}
	
	if (contentType === 'json') {
		repaired = repairTruncatedJSON(repaired);
		repaired = fixUnquotedArguments(repaired);
	}
	
	if (contentType === 'narsese') {
		repaired = repairParentheses(repaired);
	}
	
	return repaired;
}

export function tryRepairAndParse<T>(text: string, parser: (text: string) => T, contentType: 'json' | 'narsese' | 'markdown' = 'json'): T | null {
	try {
		return parser(text);
	} catch {
		try {
			const repaired = repairResponse(text, contentType);
			return parser(repaired);
		} catch {
			return null;
		}
	}
}
