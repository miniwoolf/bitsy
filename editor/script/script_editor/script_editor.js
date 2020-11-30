function ScriptEditor(scriptId) {
	var isPlaintextMode = false;

	var listener = new EventListener(events);

	var editorId = dialogScriptEditorUniqueIdCounter;
	dialogScriptEditorUniqueIdCounter++;

	var scriptRoot, div, rootEditor;
	div = document.createElement("div");

	var self = this;

	var viewportDiv;
	var expressionBuilderDiv;

	var plaintextEditor = new PlaintextScriptEditor(scriptId, "largeDialogPlaintextArea");

	var isDialogScript = (dialog[scriptId].type === ScriptType.Dialog);

	function RefreshEditorUI(width, height) {
		div.innerHTML = "";
		scriptRoot = scriptInterpreter.Compile(dialog[scriptId]);

		rootEditor = createExpressionEditor(scriptRoot, self, !isDialogScript);
		// console.log(rootEditor);

		viewportDiv = document.createElement("div");
		viewportDiv.classList.add("dialogContentViewport");

		// unselect all if you click the background
		viewportDiv.onclick = function() {
			selectionBehaviorController.UnselectAll();
		}

		viewportDiv.appendChild(rootEditor.GetElement());

		expressionBuilderDiv = document.createElement("div");
		expressionBuilderDiv.classList.add("dialogExpressionBuilderHolder");
		expressionBuilderDiv.style.display = "none";
		div.appendChild(expressionBuilderDiv);

		var innerElement = isPlaintextMode ? plaintextEditor.GetElement() : viewportDiv;

		// hack: the minus 10 is to avoid having the padding expand the element size
		if (width != undefined && height != undefined) {
			viewportDiv.style.width = (width - 10) + "px";
			viewportDiv.style.height = (height - 10) + "px";
			plaintextEditor.SetSize(width - 10, height - 10);
		}

		div.appendChild(innerElement);
	}

	RefreshEditorUI();

	this.GetElement = function() {
		return div;
	}

	this.GetScriptRoot = function() {
		return scriptRoot;
	}

	function OnUpdate() {
		var scriptStr = rootEditor.Serialize();

		var flatStr = scriptInterpreter.SerializeFlat(scriptRoot);

		if (SCRIPT_SIZE && flatStr.length > SCRIPT_SIZE) {
			alert("oh no, your script is too long! :(");
			events.Raise("select_dialog", { id: scriptId });
		}
		else {
			// handle one line scripts: a little hard coded
			if (dialog[scriptId].type === ScriptType.Dialog && scriptStr.indexOf("\n") === -1) {
				var startOffset = CURLICUE_KEY.OPEN.length + CURLICUE_KEY.DIALOG.length + 1;
				var endOffset = startOffset + CURLICUE_KEY.CLOSE.length;
				scriptStr = scriptStr.substr(startOffset, scriptStr.length - endOffset);
			}

			dialog[scriptId].src = scriptStr;

			refreshGameData();

			plaintextEditor.Refresh();

			events.Raise("dialog_update", { dialogId: scriptId, editorId: editorId, charCount: flatStr.length, });
		}
	}

	this.NotifyUpdate = function() {
		OnUpdate();
	}

	// I have to say having to put this EVERYWHERE will be annoying (oh well)
	this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
		var expressionBuilder = new ExpressionBuilder(
			expressionString,
			self, // is self the right parentEditor?
			function() { // cancel
				expressionBuilderDiv.style.display = "none";
				viewportDiv.style.display = "block";
			},
			function(expressionNode) { // accept
				expressionBuilderDiv.style.display = "none";
				viewportDiv.style.display = "block";
				onAcceptHandler(expressionNode);
			});

		expressionBuilderDiv.innerHTML = "";
		expressionBuilderDiv.appendChild(expressionBuilder.GetElement());

		expressionBuilderDiv.style.display = "block";
		viewportDiv.style.display = "none";
	}

	listener.Listen("dialog_update", function(event) {
		if (event.dialogId === scriptId && event.editorId != editorId && event.editorId != plaintextEditor.GetEditorId()) {
			RefreshEditorUI();
			plaintextEditor.Refresh();
		}
	});

	// I only listen to these events at the root of the script editor
	// since that makes it easier to clean them up when the editor
	// is destroyed and avoid leaking memory
	listener.Listen("script_node_enter", function(event) {
		if (rootEditor && rootEditor.OnNodeEnter) {
			rootEditor.OnNodeEnter(event);
		}
	});

	listener.Listen("script_node_exit", function(event) {
		if (rootEditor && rootEditor.OnNodeExit) {
			rootEditor.OnNodeExit(event);
		}
	});

	// we need to remove all the animations when we enter edit mode
	// regardless of whether we stopped the script mid-execution
	listener.Listen("on_edit_mode", function(event) {
		if (rootEditor && rootEditor.OnNodeExit) {
			rootEditor.OnNodeExit({id:null, forceClear:true});
		}
	});

	this.OnDestroy = function() {
		listener.UnlistenAll();
		plaintextEditor.OnDestroy();
	};

	this.SetPlaintextMode = function(isPlaintext) {
		var curElement = isPlaintextMode ? plaintextEditor.GetElement() : viewportDiv;
		isPlaintextMode = isPlaintext;
		RefreshEditorUI(curElement.offsetWidth, curElement.offsetHeight);
	};

	this.SetSize = function(width, height) {
		RefreshEditorUI(width, height);
	};

	this.GetSize = function() {
		var curElement = isPlaintextMode ? plaintextEditor.GetElement() : viewportDiv;

		return {
			width: curElement.offsetWidth,
			height: curElement.offsetHeight,
		};
	};

	this.AddDialog = function() {
		rootEditor.AddDialog();
	};

	this.AddChoice = function() {
		rootEditor.AddChoice();
	};

	this.AddSequence = function() {
		rootEditor.AddSequence();
	};

	this.AddCycle = function() {
		rootEditor.AddCycle();
	};

	this.AddShuffle = function() {
		rootEditor.AddShuffle();
	};

	this.AddConditional = function() {
		rootEditor.AddConditional();
	};

	this.AddPut = function() {
		rootEditor.AddPut();
	};

	this.AddRid = function() {
		rootEditor.AddRid();
	};

	this.AddHop = function() {
		rootEditor.AddHop();
	};

	this.AddChangeDrawing = function() {
		rootEditor.AddChangeDrawing();
	};

	this.AddExit = function() {
		rootEditor.AddExit();
	};

	this.AddEnd = function() {
		rootEditor.AddEnd();
	};

	this.AddPaletteSwap = function() {
		rootEditor.AddPaletteSwap();
	};

	this.GetCharCount = function() {
		var flatStr = scriptInterpreter.SerializeFlat(scriptRoot);
		return flatStr.length;
	}
}

function PlaintextScriptEditor(scriptId, style, defaultDialogNameFunc) {
	var listener = new EventListener(events);

	if (defaultDialogNameFunc === undefined) {
		defaultDialogNameFunc = null; // just to be safe
	}

	var editorId = dialogScriptEditorUniqueIdCounter;
	dialogScriptEditorUniqueIdCounter++;

	var scriptRoot, div, codeTextArea;
	div = document.createElement("div");
	div.style.lineHeight = "1";

	var self = this;

	var isDialogScript = (dialog[scriptId].type === ScriptType.Dialog);

	function RefreshEditorUI() {
		var scriptStr = dialog[scriptId].src;

		div.innerHTML = "";
		scriptRoot = scriptInterpreter.Parse(scriptStr);

		codeTextArea = document.createElement("textarea");
		codeTextArea.classList.add(style);
		codeTextArea.rows = 2;
		codeTextArea.value = isDialogScript ?
			scriptInterpreter.SerializeUnwrapped(scriptRoot) : scriptInterpreter.Serialize(scriptRoot);

		function OnTextChangeHandler() {
			var scriptStr = codeTextArea.value;
			scriptRoot = scriptInterpreter.Parse(scriptStr, isDialogScript ? DialogWrapMode.Yes : DialogWrapMode.No);

			OnUpdate();
		}
		codeTextArea.onchange = OnTextChangeHandler;
		codeTextArea.onkeyup = OnTextChangeHandler;

		codeTextArea.onblur = function() {
			OnTextChangeHandler();
			events.Raise("dialog_update", { dialogId: scriptId, editorId: editorId });
		};

		div.appendChild(codeTextArea);
	}

	RefreshEditorUI();

	this.GetElement = function() {
		return div;
	}

	this.GetScriptRoot = function() {
		return scriptRoot;
	}

	function OnUpdate() {
		var scriptStr = scriptInterpreter.Serialize(scriptRoot);
		var flatStr = scriptInterpreter.SerializeFlat(scriptRoot);

		if (SCRIPT_SIZE && flatStr.length > SCRIPT_SIZE) {
			alert("oh no, your script is too long! :(");
			events.Raise("select_dialog", { id: scriptId });
		}
		else {
			// handle one line scripts: a little hard coded
			if (dialog[scriptId].type === ScriptType.Dialog && scriptStr.indexOf("\n") === -1) {
				var startOffset = CURLICUE_KEY.OPEN.length + CURLICUE_KEY.DIALOG.length + 1;
				var endOffset = startOffset + CURLICUE_KEY.CLOSE.length;
				scriptStr = scriptStr.substr(startOffset, scriptStr.length - endOffset);
			}

			dialog[scriptId].src = scriptStr;

			refreshGameData();
		}
	}

	this.GetEditorId = function() {
		return editorId;
	}

	this.OnDestroy = function() {
		listener.UnlistenAll();
	}

	this.SetSize = function(width, height) {
		codeTextArea.style.width = width + "px";
		codeTextArea.style.height = height + "px";
	}

	this.Refresh = RefreshEditorUI;
}

// todo: too many globals?
// todo: make these global methods captalized?
function createListEditor(expression, parent, isInline) {
	var listType = null;
	if (expression.list.length > 0 && expression.list[0].type === "symbol") {
		listType = expression.list[0].value;
	}

	var editor = null;

	if (scriptInterpreter.IsDialogExpression(listType)) {
		editor = new DialogExpressionEditor(expression, parent);
	}
	else if (scriptInterpreter.IsSequence(listType)) {
		editor = new SequenceEditor(expression, parent);
	}
	else if (scriptInterpreter.IsChoice(listType)) {
		editor = new ChoiceEditor(expression, parent);
	}
	else if (scriptInterpreter.IsConditional(listType)) {
		editor = new ConditionalEditor(expression, parent);
	}
	else if (scriptInterpreter.IsTable(listType)) {
		editor = new TableEditor(expression, parent, isInline);
	}
	else if (scriptInterpreter.IsFunctionDefinition(listType)) {
		editor = new FunctionDefinitionEditor(expression, parent, isInline);
	}
	else if (library.IsMathExpression(listType)) {
		editor = new MathExpressionEditor(expression, parent, isInline);
	}
	else {
		editor = new ExpressionEditor(expression, parent, isInline);
	}

	return editor;
}

// todo : name? atom? value?
// todo : should I validate the special editors better here?
function createLiteralEditor(expression, parent, isInline, specialEditorType) {
	if (specialEditorType && specialEditorType === "room") {
		return new RoomIdEditor(expression, parent, isInline);
	}
	else if (specialEditorType && specialEditorType === "palette") {
		return new PaletteIdEditor(expression, parent, isInline);
	}
	else if (specialEditorType && specialEditorType === "sprite") {
		return new SpriteIdEditor(expression, parent, isInline);
	}
	else if (specialEditorType && specialEditorType === "item") {
		return new ItemIdEditor(expression, parent, isInline);
	}
	else if (specialEditorType && specialEditorType === "transition") {
		return new TransitionIdEditor(expression, parent, isInline);
	}
	else if (specialEditorType && specialEditorType === "direction") {
		return new DirectionEditor(expression, parent, isInline);
	}
	else if (specialEditorType && specialEditorType === "sprite entry") {
		return new SpriteEntryKeyEditor(expression, parent, isInline);
	}
	else if (specialEditorType && specialEditorType === "sprite reference") {
		return new SpriteReferenceSymbolEditor(expression, parent, isInline);
	}
	else if (specialEditorType && specialEditorType === "entry") {
		return new EntrySymbolEditor(expression, parent, isInline);
	}
	else if (expression.type === "number") {
		return new NumberEditor(expression, parent, isInline);
	}
	else if (expression.type === "string") {
		return new StringEditor(expression, parent, isInline);
	}
	else if (expression.type === "boolean") {
		return new BooleanEditor(expression, parent, isInline);
	}
	else if (expression.type === "symbol") {
		return new SymbolEditor(expression, parent, isInline);
	}
}

function createExpressionEditor(expression, parent, isInline, specialEditorType) {
	if (isInline === undefined || isInline === null) {
		isInline = false;
	}

	if (expression.type === "list") {
		return createListEditor(expression, parent, isInline);
	}
	else {
		return createLiteralEditor(expression, parent, isInline, specialEditorType);
	}
}

// oh noooo more globals....???!?!?!
var dialogScriptEditorUniqueIdCounter = 0;

function ActionEditor(editor, parentEditor, options) {
	var isInline = options && options.isInline;
	var isInlineBlock = options && options.isInlineBlock;
	var disableMoveControls = options && options.disableMoveControls;

	var div = document.createElement("div");
	div.classList.add("actionEditor");

	if (options && options.isAltColor) {
		div.classList.add("altColor");
	}
	else {
		div.classList.add("defaultColor");
	}

	if (isInline) {
		div.classList.add("inline");
	}
	else if (isInlineBlock) {
		div.classList.add("inlineBlock");

		console.log("-- ACTION EDITOR INLINE BLOCK --");
		console.log(parentEditor);

		if (parentEditor && parentEditor.GetElement) {
			console.log(parentEditor.GetElement());
			parentEditor.GetElement().classList.add("parentOfInlineBlock"); // hack
		}
	}

	if (!isInline && !isInlineBlock) {
		var orderControls = new OrderControls(editor, parentEditor, disableMoveControls);
		div.appendChild(orderControls.GetElement());
	}

	var middleColumnDiv = document.createElement("div");
	middleColumnDiv.classList.add("actionEditorMiddleColumn");
	div.appendChild(middleColumnDiv);

	var contentControlDiv = document.createElement("div");
	contentControlDiv.classList.add("contentControlsRoot");
	middleColumnDiv.appendChild(contentControlDiv);

	var customCommandDiv = document.createElement("div");
	customCommandDiv.classList.add("customControlsRoot");
	middleColumnDiv.appendChild(customCommandDiv);

	if (isInline) {
		customCommandDiv.style.display = "none";
	}

	if (!isInline && !isInlineBlock) {
		var deleteControls = new DeleteControls(editor, parentEditor);
		div.appendChild(deleteControls.GetElement());
	}

	this.GetElement = function() {
		return div;
	};

	// todo : pass in with constructor?
	this.AddContentControl = function(control) {
		contentControlDiv.appendChild(control);
	};

	this.AddCommand = function(iconId, name, onClickFunc) {
		var commandButton = document.createElement("button");
		commandButton.onclick = onClickFunc;
		customCommandDiv.appendChild(commandButton);

		var commandIcon = iconUtils.CreateIcon(iconId);
		commandIcon.classList.add("icon_space_right");
		commandButton.appendChild(commandIcon);

		var commandName = document.createElement("span");
		commandName.innerText = name;
		commandButton.appendChild(commandName);
	};

	this.ClearCommands = function() {
		customCommandDiv.innerHTML = "";
	};
}

function OrderControls(editor, parentEditor, disableMoveControls) {
	var div = document.createElement("div");
	div.classList.add("orderControls");

	var moveUpButton = document.createElement("button");
	// moveUpButton.innerText = "up";
	moveUpButton.appendChild(iconUtils.CreateIcon("arrow_up"));
	moveUpButton.onclick = function() {
		var insertIndex = parentEditor.IndexOfChild(editor);
		parentEditor.RemoveChild(editor);
		insertIndex -= 1;
		parentEditor.InsertChild(editor, insertIndex);

		UpdateControls(disableMoveControls);
	}
	div.appendChild(moveUpButton);

	var moveDownButton = document.createElement("button");
	// moveDownButton.innerText = "down";
	moveDownButton.appendChild(iconUtils.CreateIcon("arrow_down"));
	moveDownButton.onclick = function() {
		var insertIndex = parentEditor.IndexOfChild(editor);
		parentEditor.RemoveChild(editor);
		insertIndex += 1;
		parentEditor.InsertChild(editor, insertIndex);

		UpdateControls(disableMoveControls);
	}
	div.appendChild(moveDownButton);

	this.GetElement = function() {
		return div;
	}

	function UpdateControls(forceDisable) {
		if (/*!forceDisable &&*/ parentEditor.ChildCount && parentEditor.ChildCount() > 1) {
			moveUpButton.disabled = false;
			moveDownButton.disabled = false;
		}
		else {
			moveUpButton.disabled = true;
			moveDownButton.disabled = true;
		}
	}

	// UpdateControls(disableMoveControls);
}

function DeleteControls(editor, parentEditor) {
	var div = document.createElement("div");
	div.classList.add("deleteControls");

	var deleteButton = document.createElement("button");
	// deleteButton.innerText = "delete";
	deleteButton.appendChild(iconUtils.CreateIcon("delete"));
	deleteButton.style.float = "right";
	deleteButton.onclick = function() {
		editor.GetElement().classList.add("actionEditorDelete");
		// allow animation to run before deleting the editor for real
		setTimeout(function() {
			parentEditor.RemoveChild(editor);
		}, 250);
	}
	div.appendChild(deleteButton);

	this.GetElement = function() {
		return div;
	}
}

function SelectionBehaviorController() {
	var curSelectedEditor = null;

	this.AddSelectionBehavior = function (editor, onSelect, onDeselect, isInline) {
		if (isInline === undefined || isInline === null) {
			isInline = false;
		}

		editor.Select = function() {
			editor.GetElement().classList.add("selectedEditor");

			if (onSelect) {
				onSelect();
			}
		}

		editor.Deselect = function() {
			editor.GetElement().classList.remove("selectedEditor");

			if (onDeselect) {
				onDeselect();
			}
		}

		if (!isInline) {
			editor.GetElement().onclick = function(event) {
				event.stopPropagation();

				if (curSelectedEditor === editor) {
					return; // already selected!
				}

				if (curSelectedEditor != null) {
					curSelectedEditor.Deselect();
				}

				editor.Select();
				curSelectedEditor = editor;
			}
		}
	};

	this.UnselectAll = function() {
		if (curSelectedEditor != null) {
			curSelectedEditor.Deselect();
			curSelectedEditor = null;
		}
	};
};

// leaving this as global for now..
var selectionBehaviorController = new SelectionBehaviorController();
var AddSelectionBehavior = selectionBehaviorController.AddSelectionBehavior;

function ConvertNumberStringToArabic(numberString) {
	var arabicNumerals = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];

	var arabicNumberString = "";

	for (var i = 0; i < numberString.length; i++)
	{
		arabicNumberString += arabicNumerals[parseInt(numberString[i])];
	}

	return arabicNumberString;
}