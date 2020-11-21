function ScriptEditor(dialogId) {
	var isPlaintextMode = false;

	var listener = new EventListener(events);

	var editorId = dialogScriptEditorUniqueIdCounter;
	dialogScriptEditorUniqueIdCounter++;

	var scriptRoot, div, rootEditor;
	div = document.createElement("div");

	var self = this;

	var viewportDiv;
	var expressionBuilderDiv;

	var plaintextEditor = new PlaintextScriptEditor(dialogId, "largeDialogPlaintextArea");

	function RefreshEditorUI(width, height) {
		div.innerHTML = "";
		scriptRoot = scriptNext.Compile(dialog[dialogId]);

		rootEditor = createExpressionEditor(scriptRoot, self);

		viewportDiv = document.createElement("div");
		viewportDiv.classList.add("dialogContentViewport");

		// unselect all if you click the background
		viewportDiv.onclick = function() {
			selectionBehaviorController.UnselectAll();
		}

		viewportDiv.appendChild(rootEditor.GetElement());

		rootEditor.GetElement().classList.add("selectedEditor");

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
		var dialogStr = rootEditor.Serialize();

		// handle one line scripts: a little hard coded
		if (dialogStr.indexOf("\n") === -1) {
			var startOffset = SYM_KEY.OPEN.length + SYM_KEY.DIALOG.length + 1;
			var endOffset = startOffset + SYM_KEY.CLOSE.length;
			dialogStr = dialogStr.substr(startOffset, dialogStr.length - endOffset);
		}

		dialog[dialogId].src = dialogStr;

		refreshGameData();

		events.Raise("dialog_update", { dialogId:dialogId, editorId:editorId });
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
				console.log(expressionNode.Serialize());
				expressionBuilderDiv.style.display = "none";
				viewportDiv.style.display = "block";
				onAcceptHandler(expressionNode);
			});

		expressionBuilderDiv.innerHTML = "";
		expressionBuilderDiv.appendChild(expressionBuilder.GetElement());

		expressionBuilderDiv.style.display = "block";
		viewportDiv.style.display = "none";
	}

	// todo : reimplement so it doesn't lose focus
	// listener.Listen("dialog_update", function(event) {
	// 	if (event.dialogId === dialogId && event.editorId != editorId) {
	// 		RefreshEditorUI();
	// 	}
	// });

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
}

function PlaintextScriptEditor(dialogId, style, defaultDialogNameFunc) {
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

	function RefreshEditorUI() {
		var dialogStr = dialog[dialogId].src;

		div.innerHTML = "";
		scriptRoot = scriptNext.Parse(dialogStr);

		codeTextArea = document.createElement("textarea");
		codeTextArea.classList.add(style);
		codeTextArea.rows = 2;
		codeTextArea.value = scriptNext.SerializeUnwrapped(scriptRoot);
		function OnTextChangeHandler() {
			var dialogStr = codeTextArea.value;
			scriptRoot = scriptNext.Parse(dialogStr, DialogWrapMode.Yes);

			OnUpdate();
		}
		codeTextArea.onchange = OnTextChangeHandler;
		codeTextArea.onkeyup = OnTextChangeHandler;
		codeTextArea.onblur = OnTextChangeHandler;
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
		var dialogStr = scriptNext.Serialize(scriptRoot);

		// handle one line scripts: a little hard coded
		if (dialogStr.indexOf("\n") === -1) {
			var startOffset = SYM_KEY.OPEN.length + SYM_KEY.DIALOG.length + 1;
			var endOffset = startOffset + SYM_KEY.CLOSE.length;
			dialogStr = dialogStr.substr(startOffset, dialogStr.length - endOffset);
		}

		dialog[dialogId].src = dialogStr;

		refreshGameData();

		events.Raise("dialog_update", { dialogId:dialogId, editorId:editorId });
	}

	// todo : reimplement so it doesn't lose focus
	// listener.Listen("dialog_update", function(event) {
	// 	if (event.dialogId === dialogId && event.editorId != editorId) {
	// 		RefreshEditorUI();
	// 	}
	// });

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
}

// todo: too many globals?
// todo: make these global methods captalized?
function createListEditor(expression, parent, isInline) {
	var listType = null;
	if (expression.list.length > 0 && expression.list[0].type === "symbol") {
		listType = expression.list[0].value;
	}

	var editor = null;

	if (scriptNext.IsDialogExpression(listType)) {
		editor = new DialogExpressionEditor(expression, parent);
	}
	else if (scriptNext.IsSequence(listType)) {
		editor = new SequenceEditor(expression, parent);
	}
	else if (scriptNext.IsChoice(listType)) {
		editor = new ChoiceEditor(expression, parent);
	}
	else if (scriptNext.IsConditional(listType)) {
		editor = new ConditionalEditor(expression, parent);
	}
	else if (scriptNext.IsTable(listType)) {
		editor = new TableEditor(expression, parent, isInline);
	}
	else if (scriptNext.IsFunctionDefinition(listType)) {
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
	else if (specialEditorType && specialEditorType === "item") {
		return new ItemIdEditor(expression, parent, isInline);
	}
	else if (specialEditorType && specialEditorType === "transition") {
		return new TransitionIdEditor(expression, parent, isInline);
	}
	else if (specialEditorType && specialEditorType === "direction") {
		return new DirectionEditor(expression, parent, isInline);
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

function OrderControls(editor, parentEditor, disableMoveControls) {
	var div = document.createElement("div");
	div.classList.add("orderControls");
	div.style.display = "none";

	var moveUpButton = document.createElement("button");
	// moveUpButton.innerText = "up";
	moveUpButton.appendChild(iconUtils.CreateIcon("arrow_up"));
	moveUpButton.onclick = function() {
		var insertIndex = parentEditor.IndexOfChild(editor);
		parentEditor.RemoveChild(editor);
		insertIndex -= 1;
		parentEditor.InsertChild(editor, insertIndex);
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
	}
	div.appendChild(moveDownButton);

	var customButtonsContainer = document.createElement("div");
	customButtonsContainer.style.display = "inline-block";
	customButtonsContainer.style.marginLeft = "5px";
	div.appendChild(customButtonsContainer);

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

	this.GetCustomControlsContainer = function() {
		return customButtonsContainer;
	}

	editor.ShowOrderControls = function() {
		if (!disableMoveControls && parentEditor.ChildCount && parentEditor.ChildCount() > 1) {
			// TODO : replace w/ added class name?
			moveUpButton.disabled = false;
			moveDownButton.disabled = false;
		}
		else {
			moveUpButton.disabled = true;
			moveDownButton.disabled = true;
		}

		div.style.display = "block";
	}

	editor.HideOrderControls = function() {
		div.style.display = "none";
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
			if (editor.ShowOrderControls) {
				editor.ShowOrderControls();
			}
			if (onSelect) {
				onSelect();
			}
		}

		editor.Deselect = function() {
			editor.GetElement().classList.remove("selectedEditor");
			if (editor.HideOrderControls) {
				editor.HideOrderControls();
			}
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