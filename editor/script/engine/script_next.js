/*
NOTES
- BUG: when scripts take too long they interrupt player keypresses!
- should the compile then run model remain the same?
- name of language / module?
- missing functions
- better multi-line dialog script parsing by handling strings inside quotes
- what do I do about global vs local variables?
- decide whether the new style names are good
- global variables aren't working
*/

var SymNext = {
	CurlyOpen : "{",
	CurlyClose : "}",
	DialogStart : "->",
	Entry : ":",
};

function ScriptNext() {

var compiledScripts = {};

function compile(script) {
	var scriptStr = script.src;
	if (scriptStr.indexOf("\n") < 0) {
		// wrap one-line dialogs in a dialog expression
		// TODO : is this still what I want?
		scriptStr = SymNext.CurlyOpen + SymNext.DialogStart + " " + scriptStr + SymNext.CurlyClose;
	}

	var tokens = tokenize(scriptStr);
	var expressions = parse(tokens);
	compiledScripts[script.id] = expressions[0];

	return compiledScripts[script.id];
}
this.Compile = compile;

// TODO : pass in dialog buffer instead of using a global reference?
this.Run = function(script, instance, callback) {
	if (!(script.id in compiledScripts)) {
		compile(script);
	}

	// todo : lots of globals..
	var env = library.CreateScriptEnvironment(variable, dialogBuffer, instance);

	eval(compiledScripts[script.id], env, callback);
}

var RunCallback = function(script, instance, inputParameters, callback) {
	this.Run(script, instance, function(result) {
		if (result instanceof Function) {
			result(inputParameters, callback);
		}
		else {
			callback(result);
		}
	});
}
this.RunCallback = RunCallback;

// do I want a monolithic reset function like this?
this.Reset = function() {
	compiledScripts = {};
}

var indentStep = 4;

function serializeSingle(expressionList, indentDepth) {
	var out = "";

	for (var i = 0; i < expressionList.length; i++) {
		if (i > 0) {
			out += " ";
		}

		out += serialize(expressionList[i], indentDepth + indentStep); // todo : need the increase in indent?
	}

	return out;
}

function serializeMulti(expressionList, indentDepth, startBreakIndex) {
	if (startBreakIndex === undefined || startBreakIndex === null) {
		startBreakIndex = 0;
	}

	var out = "";

	for (var i = 0; i < expressionList.length; i++) {
		if (i > startBreakIndex) {
			out += "\n" + (" ".repeat(indentDepth + indentStep));
		}
		else if (i > 0) {
			out += " ";
		}

		out += serialize(expressionList[i], indentDepth + indentStep);
	}

	return out;
}

function serializeAlternating(expressionList, indentDepth) {
	var out = "";

	for (var i = 0; i < expressionList.length; i++) {
		var isChoiceResult = i > 0 && (i - 1) % 2 != 0;
		var indentNext = indentDepth + indentStep + (isChoiceResult ? indentStep : 0);

		if (i > 0) {
			out += "\n" + (" ".repeat(indentNext));
		}

		out += serialize(expressionList[i], indentNext);
	}

	return out;
}

function serializePaired(expressionList, indentDepth) {
	var out = "";

	for (var i = 0; i < expressionList.length; i++) {
		if (i > 0 && (i - 1) % 2 === 0) {
			out += "\n" + (" ".repeat(indentDepth + indentStep));
		}
		else if (i > 0) {
			out += " ";
		}

		out += serialize(expressionList[i], indentDepth + indentStep);
	}

	return out;	
}

// todo : should "SAY" be inline? "PG"?
function isInlineFunction(symbol) {
	return ["BR", "PG", "WVY", "/WVY", "SHK", "/SHK", "RBW", "/RBW", "CLR", "/CLR"].indexOf(symbol) != -1;
}
this.IsInlineFunction = isInlineFunction;

var wordWrapLen = 32; // hard coded to match default bitsy font -- make it more flexible later?

function serializeWrapped(expressionList, indentDepth) {
	var indentNext = 0;

	if (indentDepth != undefined && indentDepth != null) {
		indentNext = indentDepth + indentStep;
	}

	var out = "";

	var curLineLen = 0;
	var prevLineIsMultiLine = false;

	for (var i = 0; i < expressionList.length; i++) {
		var exp = expressionList[i];
		var expStr = serialize(expressionList[i], indentNext);
		var nextWordLen = exp.type != "list" && exp.value != SymNext.DialogStart ? expStr.length : 0;
		var isMultiLine = exp.type === "list" && !isInlineFunction(exp.list[0].value);

		if (prevLineIsMultiLine || isMultiLine || (curLineLen + nextWordLen + 1) > wordWrapLen) {
			out += "\n" + (" ".repeat(indentNext));
			curLineLen = 0;
		}
		else if (i > 0) {
			out += " ";
			curLineLen++;
		}

		prevLineIsMultiLine = isMultiLine;
		curLineLen += nextWordLen;

		out += expStr;
	}

	return out;
}
this.SerializeWrapped = serializeWrapped;

function isDialogExpression(symbol) {
	return symbol === SymNext.DialogStart;
}
this.IsDialogExpression = isDialogExpression;

function isSequence(symbol) {
	return ["SEQ", "CYC", "SHF"].indexOf(symbol) != -1;
}
this.IsSequence = isSequence;

function isChoice(symbol) {
	return symbol === "PIK";
}
this.IsChoice = isChoice;

function isConditional(symbol) {
	return symbol === "IF";
}
this.IsConditional = isConditional;

function isTable(symbol) {
	return symbol === "TBL";
}
this.IsTable = isTable;

function isFunctionDefinition(symbol) {
	return symbol === "FN";
}
this.IsFunctionDefinition = isFunctionDefinition;

// todo : nicer formatting for asignment to multiline lists?
function serializeList(expression, indentDepth) {
	var listType = null;
	if (expression.list.length > 0 && expression.list[0].type === "symbol") {
		listType = expression.list[0].value;
	}

	var out = SymNext.CurlyOpen;

	if (isDialogExpression(listType)) {
		out += serializeWrapped(expression.list, indentDepth);
	}
	else if (isSequence(listType)) {
		out += serializeMulti(expression.list, indentDepth);
	}
	else if (isChoice(listType)) {
		out += serializeAlternating(expression.list, indentDepth);
	}
	else if (isConditional(listType) || isTable(listType)) {
		out += serializePaired(expression.list, indentDepth);
	}
	else if (isFunctionDefinition(listType)) {
		out += serializeMulti(expression.list, indentDepth, 1);
	}
	else {
		out += serializeSingle(expression.list, indentDepth);
	}

	if (out.indexOf("\n") != -1) {
		out += "\n" + (" ".repeat(indentDepth));
	}

	out += SymNext.CurlyClose;

	return out;
}

function serializeAtom(value, type) {
	var out = "";

	if (type === "number") {
		out = "" + value;
	}
	else if (type === "string") {
		out = '"' + value + '"';
	}
	else if (type === "boolean") {
		out = value ? "YES" : "NO";
	}
	else if (type === "symbol") {
		out = value;
	}

	return out;
}
this.SerializeValue = serializeAtom;

function serialize(expression, indentDepth) {
	if (indentDepth === undefined || indentDepth === null) {
		indentDepth = 0;
	}

	var out = "";

	if (expression.type === "list") {
		out = serializeList(expression, indentDepth);
	}
	else {
		out = serializeAtom(expression.value, expression.type);
	}

	return out;
}
this.Serialize = serialize;

function tokenize(script) {
	// store string literals and replace them with special token
	var stringPattern = /"[\s\S]*?"/g;
	var stringLiterals = script.match(stringPattern);
	script = script.replace(stringPattern, " __string_literal__ ");

	// tokenize on whitespace
	var tokens = script
		.replace(/{/g, " { ")
		.replace(/}/g, " } ")
		.trim()
		.split(/\s+/); // split on whitespace

	// restore string literals
	var stringIndex = 0;
	for (var i = 0; i < tokens.length; i++) {
		if (tokens[i] === "__string_literal__") {
			tokens[i] = stringLiterals[stringIndex];
			stringIndex++;
		}
	}

	return tokens;
}

function parseAtom(token) {
	if (!isNaN(parseFloat(token))) {
		return {
			type: "number",
			value: parseFloat(token),
		};
	}
	else if (token[0] === "\"" && token[token.length - 1] === "\"") {
		return {
			type: "string",
			value: token.substring(1, token.length - 1),
		};
	}
	else if (token === "YES") {
		return {
			type: "boolean",
			value: true,
		};
	}
	else if (token === "NO") {
		return {
			type: "boolean",
			value: false,
		};
	}
	else {
		return {
			type: "symbol",
			value: token,
		};
	}
}
this.ParseValue = function(valueStr) { return parseAtom(valueStr).value; };

function parse(tokens, list) {
	if (list === undefined || list === null) {
		list = [];
	}

	while (tokens.length > 0) {
		var token = tokens.shift();
		if (token === SymNext.CurlyOpen) {
			list.push({
				type: "list",
				list: parse(tokens),
			});
		}
		else if (token === SymNext.CurlyClose) {
			break;
		}
		else {
			list.push(parseAtom(token));
		}
	}

	return list;
}

// TODO : consider using this generalized method?
// function evalList(expression, environment, startIndex, onIncrement, onNext, onLast) {
// 	var i = startIndex;
// 	var evalNext;
//
// 	evalNext = function() {
// 		if (i >= expression.list.length) {
// 			onLast();
// 		}
// 		else {
// 			eval(expression.list[i], environment, function(value) {
// 				onNext(value);
// 				i = onIncrement(i);
// 				evalNext();
// 			});
// 		}
// 	}
//
// 	evalNext();
// }
//
// TODO : example of how this would be used:
// var values = [];
// evalList(expression, environment,
// 	0,
// 	function(i) { return i + 1; },
// 	function(value) { values.push(value); },
// 	function() {
// 		if (values[0] instanceof Function) {
// 			values[0](values.slice(1), environment, onReturn);
// 		}
// 		// else: then what?
// 	});
//
// TODO : it also would need a special case for the SymNext.DialogStart operator

function evalList(expression, environment, onReturn) {
	var i = 0;
	var values = [];
	var evalNext;

	evalNext = function() {
		if (i >= expression.list.length) {
			if (values[0] instanceof Function) {
				values[0](values.slice(1), onReturn);
			}
			// else: then what?
		}
		else {
			eval(expression.list[i], environment, function(value) {
				values.push(value);
				i++;
				evalNext();
			});
		}
	}

	evalNext();
}

function eval(expression, environment, onReturn) {
	if (expression.type === "number" || expression.type === "string" || expression.type === "boolean") {
		onReturn(expression.value);
	}
	else if (expression.type === "symbol") {
		onReturn(environment.Get(expression.value));
	}
	else if (expression.type === "list") {
		if (expression.list[0].value in special) {
			special[expression.list[0].value](expression, environment, onReturn);
		}
		else {
			evalList(expression, environment, onReturn);
		}
	}
}

var special = {
	"SEQ": function(expression, environment, onReturn) {
		if ("index" in expression) {
			expression.index = Math.min(expression.index + 1, expression.list.length - 1);
		}
		else {
			expression.index = 1;
		}

		eval(expression.list[expression.index], environment, onReturn);
	},
	"CYC": function(expression, environment, onReturn) {
		if ("index" in expression) {
			expression.index = Math.max(1, (expression.index + 1) % expression.list.length);
		}
		else {
			expression.index = 1;
		}

		eval(expression.list[expression.index], environment, onReturn);
	},
	"SHF": function(expression, environment, onReturn) {
		if (("index" in expression) && (expression.index + 1 < expression.shuffle.length)) {
			expression.index++;
		}
		else {
			expression.index = 0;
			expression.shuffle = [];

			var unshuffled = Array(expression.list.length - 1).fill(1).map((x, y) => x + y);
			while (unshuffled.length > 0) {
				var i = Math.floor(Math.random() * unshuffled.length);
				expression.shuffle.push(unshuffled.splice(i, 1)[0]);
			}
		}

		eval(expression.list[expression.shuffle[expression.index]], environment, onReturn);
	},
	"PIK" : function(expression, environment, onReturn) {
		var i = 1;
		var evalNext;

		var buffer = environment.Get("DIALOG_BUFFER", true);

		// use this to capture the current expression
		function createReturnHandler(expression, environment, onReturn) {
			return function() {
				eval(expression, environment, onReturn);
			}
		}

		evalNext = function() {
			if (i + 1 < expression.list.length) {
				// initialize choice that will evaluate the option result
				var handler = createReturnHandler(expression.list[i + 1], environment, onReturn);

				if (buffer) {
					buffer.AddChoiceOption(handler);
				}

				// eval option (will create the choice text)
				eval(expression.list[i], environment, function() {
					i += 2;
					evalNext();
				});
			}
			else {
				// todo : need to do anything here???
			}
		};

		evalNext();
	},
	"IF": function(expression, environment, onReturn) {
		var result = null;
		var i = 1;
		var evalNext;

		evalNext = function() {
			if (i >= expression.list.length) {
				onReturn(null);
			}
			else if (i + 1 >= expression.list.length) {
				eval(expression.list[i], environment, onReturn);
			}
			else {
				eval(expression.list[i], environment, function(value) {
					if (value === true) {
						eval(expression.list[i + 1], environment, onReturn);
					}
					else {
						i += 2;
						evalNext();
					}
				});
			}
		}

		evalNext();
	},
	// todo : more creative name for functions? rename to routine? RN? RTN?
	"FN": function(expression, environment, onReturn) {
		// initialize parameter names
		var parameterNames = [];
		if (expression.list.length >= 2 && expression.list[1].type === "list") {
			var parameterList = expression.list[1];
			for (var i = 0; i < parameterList.list.length; i++) {
				if (parameterList.list[i].type === "symbol") {
					parameterNames.push(parameterList.list[i].value);
				}
			}
		}

		var result = function(parameters, onReturn) {
			// create local function environment from input parameters
			var fnEnvironment = new Table(environment); // todo : should it have access to the external environment?
			for (var i = 0; i < parameters.length; i++) {
				if (i < parameterNames.length) {
					fnEnvironment.Set(parameterNames[i], parameters[i]);
				}
			}

			// every expression after the parameter list is a statement in the function
			var result = null;
			var i = 2;
			var evalNext;

			evalNext = function() {
				if (i >= expression.list.length) {
					onReturn(result);
				}
				else {
					eval(expression.list[i], fnEnvironment, function(value) {
						result = value;
						i++;
						evalNext();
					});
				}
			}

			evalNext();
		};

		onReturn(result);
	},
	// todo : name? LET instead?
	"SET": function(expression, environment, onReturn) {
		// todo : assumes the right number of list elements, etc.
		eval(expression.list[2], environment, function(value) {
			// todo : what about local variables?
			environment.SetGlobal(expression.list[1].value, value);
			onReturn(null);
		});
	},
	"TBL": function(expression, environment, onReturn) {
		var table = new Table();
		var i = 1;
		var evalNext;

		evalNext = function() {
			if (i >= expression.list.length) {
				onReturn(table);
			}
			else {
				if (expression.list[i].type === "symbol" && expression.list[i].value[0] === SymNext.Entry) {
					var name = expression.list[i].value.slice(1);
					i++;

					// TODO : what if there's an out-of-index error?
					eval(expression.list[i], environment, function(value) {
						table.Set(name, value);
						i++;
						evalNext();
					});
				}
				else {
					// for now, skip invalid syntax
					// TODO : decide whether to allow a lua-like "list" form
					i++;
					evalNext();
				}
			}
		}

		evalNext();
	},
}

// hacky?
special[SymNext.DialogStart] = function(expression, environment, onReturn) {
	var result = null;
	var i = 1;
	var evalNext;

	// todo : what if no buffer is available?
	var buffer = environment.Get("DIALOG_BUFFER", true);

	evalNext = function() {
		if (i >= expression.list.length) {
			onReturn(result);
		}
		else {
			if (expression.list[i].type === "string") {
				if (buffer) {
					buffer.AddText(expression.list[i].value);
				}

				result = null;
				i++;
				evalNext();
			}
			else if (expression.list[i].type != "list") {
				if (buffer) {
					buffer.AddWord(serializeAtom(expression.list[i].value, expression.list[i].type));
				}

				result = null;
				i++;
				evalNext();
			}
			else {
				eval(expression.list[i], environment, function(value) { result = value; i++; evalNext(); });
			}
		}
	}

	evalNext();
};

special[SymNext.Entry] = function(expression, environment, onReturn) {
	if (expression.list.length < 3) {
		onReturn(null); // not enough arguments!
	}

	var key = expression.list[2].value;

	eval(expression.list[1], environment, function(table) {
		// todo : handle null / invalid tables
		if (expression.list.length >= 4) {
			eval(expression.list[3], environment, function(value) {
				table.Set(key, value);
				onReturn(value);
			});
		}
		else if (table.Has(key)) {
			onReturn(table.Get(key));
		}
		else {
			onReturn(null); // no value!
		}
	});
};

} // ScriptNext

function Table(parent) {
	var entries = {};
	var keyList = []; // maintained in insertion order
	var readOnlyEntries = {}; // todo : is this the best way to keep track of this?

	var hasParent = parent != undefined && parent != null;

	var GetInternalKey = function(key, isSecret) {
		return isSecret ? key : SymNext.Entry + key;
	}

	this.Has = function(key, isSecret) {
		var hasEntry = false;
		var internalKey = GetInternalKey(key, isSecret);

		if (entries.hasOwnProperty(internalKey)) {
			hasEntry = true;
		}
		else if (hasParent && parent.Has(key, isSecret)) {
			hasEntry = true;
		}

		return hasEntry;
	}

	this.Get = function(key, isSecret) {
		var value = false;
		var internalKey = GetInternalKey(key, isSecret);

		if (entries.hasOwnProperty(internalKey)) {
			value = entries[internalKey];
		}
		else if (hasParent && parent.Has(key, isSecret)) {
			value = parent.Get(key, isSecret);
		}

		return value;
	}

	function set(key, value, options) {
		var isGlobal = options && options.isGlobal;
		var isSecret = options && options.isSecret;
		var isReadOnly = options && options.isReadOnly;
		var externalKey = options && options.externalKey ? options.externalKey : null;

		var internalKey = GetInternalKey(key, isSecret);
		var hasInternalEntry = entries.hasOwnProperty(internalKey);

		if ((!hasInternalEntry || readOnlyEntries[internalKey]) && hasParent && (isGlobal || parent.Has(key, isSecret))) {
			parent.Set(key, value, options);
		}
		else if (!readOnlyEntries[internalKey]) {
			if (!isSecret && !hasInternalEntry) {
				keyList.push(key);
			}

			if (isReadOnly) {
				readOnlyEntries[internalKey] = true;
			}

			if (!hasInternalEntry) {
				AddGetterSetter(externalKey != null ? externalKey : key, internalKey);
			}

			entries[internalKey] = value;
		}

		return value;
	}

	this.Set = set;

	this.SetGlobal = function(key, value) {
		set(key, value, { isGlobal: true });
	}

	this.SetSecret = function(key, value) {
		set(key, value, { isSecret: true });
	}

	// only includes keys for entries that are not secret
	this.Keys = function() {
		return keyList;
	}

	// adds external getter and setter for convenience of the engine
	var AddGetterSetter = (function(table) {
		return function(externalKey, internalKey) {
			var getterSetter = {};

			getterSetter[externalKey] = {
				get : function() {
					return entries[internalKey];
				},
				set : function(value) {
					entries[internalKey] = value;
				},
			};

			Object.defineProperties(table, getterSetter);
		};
	})(this);
} // Table