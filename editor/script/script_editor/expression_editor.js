// todo : update for new names, new functions, etc
var expressionDescriptionMap = {
	"END" : {
		GetName : function() {
			return localization.GetStringOrFallback("function_end_name", "end");
		},
		GetDescription : function() {
			// todo : localize
			return "stop the game [-- wait for input first? _]";
		},
		GetHelpText : function() {
			// todo : localize
			return "the game stops after the current page, but dialog after this action will still play";
		},
		parameters : [
			{ types: ["boolean", "symbol"], index: 0, name: "wait for input?", },
		],
	},
	"EXT" : {
		GetName : function() {
			return localization.GetStringOrFallback("function_exit_name", "exit");
		},
		GetDescription : function() {
			// todo : localize
			return "move player to _ at (_,_)[ with effect _] [-- wait for input first? _]";
		},
		parameters : [
			{ types: ["room", "string", "symbol"], index: 0, name: "room", },
			{ types: ["number", "symbol"], index: 1, name: "x", },
			{ types: ["number", "symbol"], index: 2, name: "y", },
			{ types: ["transition", "string", "symbol"], index: 3, name: "transition effect", },
			{ types: ["boolean", "symbol"], index: 4, name: "wait for input?", },
		],
		commands :
			[{
				iconId: "set_exit_location",
				getName: function() { return localization.GetStringOrFallback("exit_destination_move", "move destination"); },
				createCommand: CreateSelectExitLocationCommand,
			}],
	},
	// todo : add to text effects instead? along with BR?
	"BR" : {
		GetName : function() { return "linebreak"; }, // todo : localize
		GetDescription : function() { return "start a new line of dialog"; },
		parameter : [],
	},
	"PG" : {
		GetName : function() {
			return localization.GetStringOrFallback("function_pg_name", "pagebreak");
		},
		GetDescription : function() {
			return localization.GetStringOrFallback("function_pg_description", "start a new page of dialog");
		},
		GetHelpText : function() {
			return localization.GetStringOrFallback(
				"function_pg_help",
				"if there are actions after this one, they will start after the player presses continue");
		},
		parameters : [],
	},
	"ITM" : {
		GetName : function() {
			return localization.GetStringOrFallback("function_item_name", "item");
		},
		GetDescription : function() {
			// todo : update text to match "is set to" convention?
			// return localization.GetStringOrFallback("function_item_description", "_ in inventory[ = _]");
			// todo : localize
			return "_ in inventory[ is set to _]";
		},
		parameters : [
			{ types: ["item", "string", "symbol"], index: 0, name: "item", },
			{ types: ["number", "symbol"], index: 1, name: "amount", },
		],
	},
	"SAY" : {
		GetName : function() {
			return localization.GetStringOrFallback("function_say_name", "say");
		},
		GetDescription : function() {
			return localization.GetStringOrFallback("function_print_description", "print _ in the dialog box");
		},
		parameters : [
			{ types: ["string", "symbol"], index: 0, name: "output", },
		],
	},
	"SET" : {
		GetName : function() { return "set variable value"; }, // todo : localize
		GetDescription : function() { return "variable _ is set to _" }, // todo : localize
		parameters : [
			{ types: ["symbol"], index: 0, name: "variable", },
			{ types: ["number", "boolean", "string", "symbol", "list"], index: 1, name: "value", },
		],
	},
	"VAR" : {
		GetName : function() { return "make local variable"; }, // todo : localize
		GetDescription : function() { return "local variable _ is set to _" }, // todo : localize
		parameters : [
			{ types: ["symbol"], index: 0, name: "variable", },
			{ types: ["number", "boolean", "string", "symbol", "list"], index: 1, name: "value", },
		],
	},
	"HOP" : {
		GetName : function() { return "hop"; }, // todo : localize
		GetDescription : function() { return "move _ one space _"; },
		parameters : [
			// todo : create special parameter type for sprite references
			{ types: ["sprite reference", "symbol", "list"], index: 0, name: "sprite", },
			{ types: ["direction", "string", "symbol", "list"], index: 1, name: "direction", },
		],
	},
	"PUT" : {
		GetName : function() { return "put down new sprite"; }, // todo : localize
		GetDescription : function() { return "put _ [ at (_| here][,_)]"; }, // todo : localize
		parameters : [
			// todo : create special parameter type for sprite IDs
			{ types: ["sprite", "string", "symbol", "list"], index: 0, name: "sprite", },
			// todo : it would be better if these were added all at once instead of piecemeal (command like room pos?)
			{ types: ["number", "symbol", "list"], index: 1, name: "x position", },
			{ types: ["number", "symbol", "list"], index: 2, name: "y position", },
		],
		commands :
			[{
				iconId: "set_exit_location",
				// todo : localize
				getName: function() { return "select sprite location"; },
				createCommand: CreateSelectSpriteLocationCommand,
			}],
	},
	"RID" : {
		GetName : function() { return "get rid of sprite"; }, // todo : localize
		GetDescription : function() { return "get rid of _"; }, // todo : localize todo : swap title and description?
		parameters : [
			{ types: ["sprite reference", "symbol", "list"], index: 0, name: "sprite", },
		],
	},
	"PAL" : {
		GetName : function() { return "palette swap"; }, // todo : localize
		GetDescription : function() { return "change palette of current room to _"; }, // todo : localize
		parameters : [
			{ types: ["palette", "string", "symbol", "list"], index: 0, name: "palette", },
		],
	},
	"default" : {
		GetName : function() { return "function"; }, // todo : localize
		GetDescription : function() {
			return "evaluate _ with input:"; // todo : localize
		},
		parameters: [ { types: ["symbol"], index: -1, name: "name", } ], // todo : the -1 is hacky
	},
};

// hacky?
expressionDescriptionMap[CURLICUE_KEY.ENTRY] = {
	GetName : function() { return "entry value"; }, // todo : localize
	GetDescription : function() { return "_ of _[ is set to _]"; }, // todo : localize! and wording?
	parameters : [
		{ types: ["sprite entry", "symbol", "list"], index: 1, name: "entry", }, // todo : localize
		{ types: ["sprite reference", "symbol", "list"], index: 0, name: "table", }, // todo : localize
		{ types: ["number", "boolean", "string", "symbol", "list"], index: 2, name: "value", },
	],
	// TODO : add help text?
};

var isHelpTextOn = false;

// TODO : support UNDESCRIBED functions! need a new editor?
function ExpressionEditor(expression, parentEditor, isInline) {
	if (isInline === undefined || isInline === null) {
		isInline = false;
	}

	var self = this;

	// todo : what if the first expression is not a symbol?
	var symbol = expression.list[0].value;
	var descriptionId = symbol in expressionDescriptionMap ? symbol : "default";
	var paramLength = expression.list.length - 1;

	var div = document.createElement("div");
	div.classList.add("functionEditor");

	if (isInline) {
		div.classList.add("inline");
	}

	var actionEditor = null;

	actionEditor = new ActionEditor(this, parentEditor, { isInline: isInline, });
	actionEditor.AddContentControl(div);

	if (!isInline) {
		var titleText = expressionDescriptionMap[descriptionId].GetName();
		var titleDiv = document.createElement("div");
		titleDiv.classList.add("actionTitle");
		titleDiv.innerText = titleText;
		div.appendChild(titleDiv);
	}

	var descriptionDiv = document.createElement("div");
	descriptionDiv.classList.add("actionDescription");
	div.appendChild(descriptionDiv);

	var editParameterTypes = false;

	var helpTextDiv = null;
	var helpTextContent = null;
	var hasHelpText = false;
	var helpTextFunc = expressionDescriptionMap[descriptionId].GetHelpText;
	hasHelpText = helpTextFunc != undefined && helpTextFunc != null;

	if (!isInline && hasHelpText) {
		helpTextDiv = document.createElement("div");
		helpTextDiv.classList.add("helpText");
		helpTextDiv.style.display = "none";
		div.appendChild(helpTextDiv);

		var helpTextImgHolder = document.createElement("div");
		helpTextImgHolder.classList.add("helpTextImg");
		helpTextDiv.appendChild(helpTextImgHolder);

		var catImg = document.createElement("img");

		catImg.src = "image/cat.svg";
		helpTextImgHolder.appendChild(catImg);
		helpTextContent = document.createElement("div");
		helpTextContent.classList.add("helpTextContent");
		helpTextDiv.appendChild(helpTextContent);

		helpTextContent.innerText = helpTextFunc();
	}

	// TODO : populate default values!!
	var curEditableState = false;
	var curParameterEditors = [];
	var curCommandEditors = []; // store custom commands
	function CreateExpressionDescription(isEditable) {
		curEditableState = isEditable;
		actionEditor.ClearCommands();

		paramLength = expression.list.length - 1;
		curParameterEditors = [];
		descriptionDiv.innerHTML = "";

		var descriptionText = expressionDescriptionMap[descriptionId].GetDescription();
		var descriptionTextSplit = descriptionText.split("_");

		var i = 0;

		for (; i < descriptionTextSplit.length; i++) {
			var text = descriptionTextSplit[i];

			if (text.indexOf("][") >= 0) {
				// hacky way to handle multiple optional parameters D:
				var optionalTextMidSplit = text.split("][");
				var optionalTextMidDefaultSplit = optionalTextMidSplit[0].split("|");

				var prevParam = expressionDescriptionMap[descriptionId].parameters[i - 1];
				if (paramLength > prevParam.index) {
					text = optionalTextMidDefaultSplit[0];
				}
				else if (optionalTextMidDefaultSplit.length > 1) {
					text = optionalTextMidDefaultSplit[1];
				}

				var nextParam = expressionDescriptionMap[descriptionId].parameters[i];
				if (paramLength > nextParam.index && optionalTextStartSplit.length > 1) {
					text += optionalTextMidSplit[1];
				}
			}
			else if (text.indexOf("[") >= 0) { // optional parameter text start
				var optionalTextStartSplit = text.split("[");
				text = optionalTextStartSplit[0];

				var nextParam = expressionDescriptionMap[descriptionId].parameters[i];

				if (paramLength > nextParam.index && optionalTextStartSplit.length > 1) {
					text += optionalTextStartSplit[1];
				}
			}
			else if (text.indexOf("]") >= 0) { // optional parameter text end
				var optionalTextEndSplit = text.split("]");
				var optionalTextEndDefaultSplit = optionalTextEndSplit[0].split("|");

				var prevParam = expressionDescriptionMap[descriptionId].parameters[i - 1];

				if (paramLength > prevParam.index) {
					text = optionalTextEndDefaultSplit[0];
				}
				else if (optionalTextEndDefaultSplit.length > 1) {
					text = optionalTextEndDefaultSplit[1];
				}
				else {
					text = "";
				}
			}

			// clean up text: I feel like I should be able to make this not necessary..
			text = text.replaceAll("[", " ").replaceAll("]", " ").trim();

			console.log(text);

			if (text.length > 0 && text != " ") {
				var descriptionSpan = document.createElement("span");
				descriptionSpan.innerText = text;
				descriptionDiv.appendChild(descriptionSpan);
			}

			if (i < descriptionTextSplit.length - 1) {
				var parameterInfo = expressionDescriptionMap[descriptionId].parameters[i];

				if (paramLength > parameterInfo.index) {
					// todo : needs options?
					var parameterEditor = new ExpressionTypePicker(
						expression.list[parameterInfo.index + 1],
						self,
						parameterInfo.types.concat(["list"]));

					if (isEditable) {
						if (!parameterEditor.SkipAutoSelect) {
							parameterEditor.Select();
						}
						parameterEditor.SetTypeEditable(editParameterTypes);
					}

					curParameterEditors.push(parameterEditor);
					descriptionDiv.appendChild(parameterEditor.GetElement());
				}
				else if (!isInline && isEditable && paramLength == parameterInfo.index && parameterInfo.name) {
					function createAddParameterHandler(expression, parameterInfo) {
						return function() {
							expression.list.push(CreateDefaultExpression(parameterInfo.types[0]));
							CreateExpressionDescription(true);
							parentEditor.NotifyUpdate();
						}
					}

					actionEditor.AddCommand("add", parameterInfo.name, createAddParameterHandler(expression, parameterInfo));
				}
			}
		}

		// add any additional parameters that go beyond the defined description
		i -= (descriptionId === "default" ? 2 : 1); // ok this is pretty awkward to me
		var inputSeperator = " ";

		for (; i < paramLength; i++) {
			var spaceSpan = document.createElement("span");
			spaceSpan.innerText = inputSeperator;
			descriptionDiv.appendChild(spaceSpan);

			// todo : needs any options?
			var parameterEditor = new ExpressionTypePicker(
				expression.list[i + 1],
				self, // or should this be parent editor?
				["number", "text", "boolean", "symbol", "list"]);

			if (isEditable) {
				if (!parameterEditor.SkipAutoSelect) {
					parameterEditor.Select();
				}
				parameterEditor.SetTypeEditable(editParameterTypes);
			}

			curParameterEditors.push(parameterEditor);
			descriptionDiv.appendChild(parameterEditor.GetElement());

			inputSeperator = ", ";
		}

		// add custom edit commands
		var commands = expressionDescriptionMap[descriptionId].commands;
		if (isEditable && commands) {
			for (var i = 0; i < commands.length; i++) {
				actionEditor.AddCommand(commands[i].iconId, commands[i].getName(), commands[i].createCommand(expression, self));
			}
		}

		if (!isInline) {
			if (isEditable && hasHelpText && isHelpTextOn && helpTextDiv) {
				helpTextDiv.style.display = "flex";
			}
			else if (helpTextDiv) {
				helpTextDiv.style.display = "none";
			}
		}

		if (isEditable) {
			if (hasHelpText) {
				actionEditor.AddCommand("help", "help", function() {
					isHelpTextOn = !isHelpTextOn;

					// hacky
					if (hasHelpText && isHelpTextOn && helpTextDiv) {
						helpTextDiv.style.display = "flex";
					}
					else if (helpTextDiv) {
						helpTextDiv.style.display = "none";
					}
				});
			}

			actionEditor.AddCommand("settings", "edit input types", function() {
				editParameterTypes = !editParameterTypes;
				CreateExpressionDescription(true);
			});
		}
	}

	CreateExpressionDescription(false);

	this.GetElement = function() {
		return isInline ? div : actionEditor.GetElement();
	}

	this.GetExpressionList = function() {
		return [expression];
	}

	this.NotifyUpdate = function(event) {
		if (event && event.changeOtherParameter) {
			if (event.changeOtherParameter.value === null && expression.list.length >= event.changeOtherParameter.index) {
				expression.list = expression.list.slice(0, event.changeOtherParameter.index);
			}
			else if (expression.list.length >= event.changeOtherParameter.index) {
				expression.list[event.changeOtherParameter.index] = {
					type: event.changeOtherParameter.type,
					value: event.changeOtherParameter.value,
				};
			}
			else {
				// todo : will this break in some cases?
				expression.list.push({
					type: event.changeOtherParameter.type,
					value: event.changeOtherParameter.value,
				});
			}

			CreateExpressionDescription(true);
		}
		else if (event && event.forceUpdate) {
			CreateExpressionDescription(curEditableState);
		}

		parentEditor.NotifyUpdate();
	}

	this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
		parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
	}

	AddSelectionBehavior(
		this,
		function() { CreateExpressionDescription(true); }, /*onSelect*/
		function() { /*onDeselect*/
			for (var i = 0; i < curParameterEditors.length; i++) {
				if (curParameterEditors[i].Deselect) {
					curParameterEditors[i].Deselect();
				}
			}

			CreateExpressionDescription(false);
		},
		isInline);

	this.OnNodeEnter = function(event) {
		if (!isInline && event.id === node.GetId()) {
			div.classList.add("executing");
		}
	};

	this.OnNodeExit = function(event) {
		if (!isInline && (event.id === node.GetId() || event.forceClear)) {
			div.classList.remove("executing");
			div.classList.remove("executingLeave");
			void div.offsetWidth; // hack to force reflow to allow animation to restart
			div.classList.add("executingLeave");
			setTimeout(function() { div.classList.remove("executingLeave") }, 1100);
		}
	};
}

function CreateSelectExitLocationCommand(expression, parentEditor) {
	return function() {
		roomTool.OnSelectLocation(
			function(roomId, x, y) {
				if (expression.list.length >= 4) {
					expression.list[1] = { type: "string", value: roomId, };
					expression.list[2] = { type: "number", value: x, };
					expression.list[3] = { type: "number", value: y, };

					parentEditor.NotifyUpdate({ forceUpdate: true, });
				}
				// todo : what if no location exists?
			},
			function() {
				// todo
			},
			{
				// todo : localize
				message: "click in room to select exit location",
			});
	}
}

function CreateSelectSpriteLocationCommand(expression, parentEditor) {
	return function() {
		roomTool.OnSelectLocation(
			function(roomId, x, y) {
				if (expression.list.length >= 4) {
					expression.list[2] = { type: "number", value: x, };
					expression.list[3] = { type: "number", value: y, };

					parentEditor.NotifyUpdate({ forceUpdate: true, });
				}
				else if (expression.list.length >= 3) {
					expression.list[2] = { type: "number", value: x, };
					expression.list.push({ type: "number", value: y, });

					parentEditor.NotifyUpdate({ forceUpdate: true, });
				}
				else if (expression.list.length >= 2) {
					expression.list.push({ type: "number", value: x, });
					expression.list.push({ type: "number", value: y, });

					parentEditor.NotifyUpdate({ forceUpdate: true, });
				}
			},
			function() {
				// todo
			},
			{
				// todo : localize
				message: "click in room to select new sprite location",
			});
	}
}