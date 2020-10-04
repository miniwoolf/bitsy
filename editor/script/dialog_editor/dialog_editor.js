/*
TODO dialog editor refactor:
- continue re organizing files until this is smaller...
- start by getting functions working
- need to support undescribed functions
- rename this root tool class? rename file?
- ideas
	- remove word wrap in text area -- just do it in serialization
	- try out WYSIWYG preview but only when you click away from the text boxes
	- I can do a lot to combine and simplify this stuff -- look at the serialization code for ideas
*/

function DialogTool() {
	this.CreateEditor = function(dialogId) {
		return new DialogScriptEditor(dialogId);
	}

	this.CreatePlaintextEditor = function(dialogId, style) {
		return new PlaintextDialogScriptEditor(dialogId, style);
	}

	// todo : name?
	this.CreateWidget = function(label, parentPanelId, dialogId, allowNone, onChange, creationOptions) {
		return new DialogWidget(label, parentPanelId, dialogId, allowNone, onChange, creationOptions);
	}

	this.CreateTitleWidget = function() {
		return new TitleWidget();
	}

	// find (non-inline) non-dialog code in a script
	function FindCodeVisitor() {
		var foundCode = false;
		this.FoundCode = function() {
			return foundCode;
		}

		this.Visit = function(node) {
			if (node.type === "code_block" && !scriptUtils.IsInlineCode(node)) {
				foundCode = true;
			}
		}
	}

	// TODO : label should be label localization id
	function DialogWidget(label, parentPanelId, dialogId, allowNone, onChange, creationOptions) {
		var listener = new EventListener(events);

		// treat deleted dialogs as non-existent ones
		if (!dialog.hasOwnProperty(dialogId)) {
			dialogId = null;
		}

		function DoesDialogExist() {
			return dialogId != undefined && dialogId != null && dialog.hasOwnProperty(dialogId);
		}

		var showSettings = false;

		var div = document.createElement("div");
		div.classList.add("controlBox");

		var controlDiv = document.createElement("div");
		controlDiv.style.display = "flex"; // todo : style
		div.appendChild(controlDiv);

		var labelSpan = document.createElement("span");
		labelSpan.style.flexGrow = 1;
		labelSpan.innerHTML = iconUtils.CreateIcon("dialog").outerHTML + ' ' + label;
		controlDiv.appendChild(labelSpan);

		var settingsButton = document.createElement("button");
		settingsButton.appendChild(iconUtils.CreateIcon("settings"));
		controlDiv.appendChild(settingsButton);

		var openButton = document.createElement("button");
		openButton.title = "open in dialog editor"; // todo : localize
		openButton.appendChild(iconUtils.CreateIcon("open_tool"));
		openButton.onclick = function() {
			// create an empty dialog if none exists to open in the editor
			if (!DoesDialogExist()) {
				// todo : there's a lot of duplicate code in this widget for different dialog creation workflows
				var id = nextAvailableDialogId();
				dialog[id] = {
					src: "",
					name: creationOptions && creationOptions.GetDefaultName ? creationOptions.GetDefaultName() : null,
				};
				ChangeSelectedDialog(id);
				events.Raise("new_dialog", {id:id});
			}

			events.Raise("select_dialog", { id: dialogId, insertNextToId: parentPanelId });

			// hacky global state!
			if (dialog[getCurDialogId()] && dialogId != getCurDialogId()) {
				// disable always on mode when you open up exit or ending dialog!
				alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;
			}
		};
		controlDiv.appendChild(openButton);

		var editorDiv = document.createElement("div");
		var scriptEditor;
		function UpdateEditorContent(shouldOpenDialogToolIfComplex) {
			editorDiv.innerHTML = "";

			if (DoesDialogExist() || (creationOptions && creationOptions.CreateFromEmptyTextBox)) {
				if (scriptEditor) {
					scriptEditor.OnDestroy();
					scriptEditor = null;
				}

				var defaultDialogNameFunc = creationOptions && creationOptions.GetDefaultName ? creationOptions.GetDefaultName : null;
				scriptEditor = new PlaintextDialogScriptEditor(dialogId, "miniDialogPlaintextArea", defaultDialogNameFunc);
				editorDiv.appendChild(scriptEditor.GetElement());

				CheckForComplexCodeInDialog(shouldOpenDialogToolIfComplex);
			}
			else if (creationOptions && creationOptions.Presets) {
				function CreatePresetHandler(scriptStr, getDefaultNameFunc) {
					return function() {
						dialogId = nextAvailableDialogId();
						dialog[dialogId] = {
							src: scriptStr,
							name: (getDefaultNameFunc ? getDefaultNameFunc() : null),
						}; // TODO: I really need a standard way to init dialogs now!
						events.Raise("new_dialog", {id:dialogId});
						// TODO replace OnCreateNewDialog with OnCHange!!!!
						if (creationOptions.OnCreateNewDialog) {
							creationOptions.OnCreateNewDialog(dialogId);
						}
						UpdateEditorContent(true);
					}
				}

				for (var i = 0; i < creationOptions.Presets.length; i++) {
					var preset = creationOptions.Presets[i];
					var presetButton = document.createElement("button");
					presetButton.style.flexGrow = 1; // TODO : style?
					presetButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + preset.Name;
					presetButton.onclick = CreatePresetHandler(preset.Script, preset.GetDefaultName);
					editorDiv.appendChild(presetButton);
				}
			}
		}

		editorDiv.style.display = "flex";
		editorDiv.style.marginTop = "5px";
		div.appendChild(editorDiv);

		function ChangeSelectedDialog(id) {
			dialogId = id;
			UpdateEditorContent();
			if (onChange != null) {
				onChange(dialogId);
			}
			refreshGameData();
		}

		var dialogIdSelect = document.createElement("select");
		dialogIdSelect.style.display = "none";
		dialogIdSelect.onchange = function(e) {
			ChangeSelectedDialog(e.target.value === "none" ? null : e.target.value);
		}
		div.appendChild(dialogIdSelect);

		function UpdateDialogIdSelectOptions() {
			dialogIdSelect.innerHTML = "";
			var dialogIdList = sortedDialogIdList();
			if (allowNone) {
				var dialogNoneOption = document.createElement("option");
				dialogNoneOption.innerText = "none";
				dialogNoneOption.value = "none";
				dialogNoneOption.selected = dialogId === null;
				dialogIdSelect.appendChild(dialogNoneOption);
			}
			for (var i = 0; i < dialogIdList.length; i++) {
				var dialogIdOption = document.createElement("option");
				if (dialog[dialogIdList[i]].name != null) {
					dialogIdOption.innerText = dialog[dialogIdList[i]].name;
				}
				else {
					dialogIdOption.innerText = localization.GetStringOrFallback("dialog_block_basic", "dialog") + " " + dialogIdList[i];
				}
				dialogIdOption.value = dialogIdList[i];
				dialogIdOption.selected = dialogId === dialogIdList[i];
				dialogIdSelect.appendChild(dialogIdOption);
			}
		}

		UpdateDialogIdSelectOptions();
		UpdateEditorContent();
		
		listener.Listen("new_dialog", function() { UpdateDialogIdSelectOptions(); });
		listener.Listen("dialog_update", function(event) {
			if (dialogId === event.dialogId && !DoesDialogExist()) {
				ChangeSelectedDialog(null);
				UpdateDialogIdSelectOptions();
			}

			if (scriptEditor != null && event.editorId == scriptEditor.GetEditorId()) {
				if (dialogId != event.dialogId) {
					dialogId = event.dialogId;
					if (creationOptions.OnCreateNewDialog) {
						creationOptions.OnCreateNewDialog(dialogId);
					}
				}
			}
			else if (scriptEditor != null && event.editorId != scriptEditor.GetEditorId()) {
				// if we get an update from a linked editor saying this dialog
				// is now complex, switch to the select view
				if (DoesDialogExist() && dialogId === event.dialogId) {
					CheckForComplexCodeInDialog();
				}
			}
		})

		function ChangeSettingsVisibility(visible) {
			showSettings = visible;
			settingsButton.innerHTML = iconUtils.CreateIcon(showSettings ? "text_edit" : "settings").outerHTML;
			editorDiv.style.display = showSettings ? "none" : "flex";
			dialogIdSelect.style.display = showSettings ? "flex" : "none";
		}

		settingsButton.onclick = function() {
			ChangeSettingsVisibility(!showSettings);
		}

		function CheckForComplexCodeInDialog(shouldOpenIfComplex) {
			var codeVisitor = new FindCodeVisitor();
			scriptEditor.GetNode().VisitAll(codeVisitor);
			if (codeVisitor.FoundCode()) {
				ChangeSettingsVisibility(true);

				// kind of a werid pattern to use
				if (shouldOpenIfComplex != undefined && shouldOpenIfComplex != null && shouldOpenIfComplex == true) {
					events.Raise("select_dialog", { id: dialogId, insertNextToId: parentPanelId });
				}
			}
		}

		this.GetElement = function() {
			return div;
		}

		this.OnDestroy = function() {
			if (scriptEditor) {
				scriptEditor.OnDestroy();
				delete scriptEditor;
			}
			listener.UnlistenAll();
		}
	}

	function PlaintextDialogScriptEditor(dialogId, style, defaultDialogNameFunc) {
		var listener = new EventListener(events);

		if (defaultDialogNameFunc === undefined) {
			defaultDialogNameFunc = null; // just to be safe
		}

		function DoesDialogExist() {
			return dialogId != undefined && dialogId != null && dialog.hasOwnProperty(dialogId);
		}

		var editorId = dialogScriptEditorUniqueIdCounter;
		dialogScriptEditorUniqueIdCounter++;

		var scriptRootNode, div;
		div = document.createElement("div");
		div.style.width = "100%"; // hack

		var self = this;

		function RefreshEditorUI() {
			var dialogStr = !DoesDialogExist() ? "" : dialog[dialogId].src;

			div.innerHTML = "";
			scriptRootNode = scriptInterpreter.Parse(dialogStr, dialogId);

			var dialogBoxContainer = document.createElement("div");
			dialogBoxContainer.classList.add("dialogBoxContainer");
			div.appendChild(dialogBoxContainer);

			var codeTextArea = document.createElement("textarea");
			codeTextArea.rows = 2;
			codeTextArea.cols = 32;
			codeTextArea.classList.add(style);
			codeTextArea.value = scriptRootNode.Serialize();
			function OnTextChangeHandler() {
				var dialogStr = '"""\n' + codeTextArea.value + '\n"""'; // single lines?
				scriptRootNode = scriptInterpreter.Parse(dialogStr, dialogId);

				// useful debug messages when parsing is broken:
				// scriptInterpreter.DebugVisualizeScriptTree(scriptRootNode);
				// console.log(dialogStr);
				// console.log(scriptRootNode.Serialize());

				OnUpdate();
			}
			codeTextArea.onchange = OnTextChangeHandler;
			codeTextArea.onkeyup = OnTextChangeHandler;
			codeTextArea.onblur = OnTextChangeHandler;
			dialogBoxContainer.appendChild(codeTextArea);
		}

		RefreshEditorUI();

		this.GetElement = function() {
			return div;
		}

		this.GetNode = function() {
			return scriptRootNode;
		}

		function OnUpdate() {
			var dialogStr = scriptRootNode.Serialize();

			var didMakeNewDialog = false;
			if (dialogStr.length > 0 && !DoesDialogExist()) {
				dialogId = nextAvailableDialogId();
				dialog[dialogId] = { src: "", name: defaultDialogNameFunc ? defaultDialogNameFunc() : null }; // init new dialog
				didMakeNewDialog = true;
			}

			if (!DoesDialogExist()) {
				return;
			}

			if (dialogStr.indexOf("\n") > -1) {
				// hacky - expose the triple-quotes symbol somewhere?
				dialogStr = '"""\n' + dialogStr + '\n"""';
			}

			dialog[dialogId].src = dialogStr;

			refreshGameData();

			events.Raise("dialog_update", { dialogId:dialogId, editorId:editorId });
			if (didMakeNewDialog) {
				events.Raise("new_dialog", {id:dialogId});
			}
		}

		listener.Listen("dialog_update", function(event) {
			if (DoesDialogExist() && event.dialogId === dialogId && event.editorId != editorId) {
				RefreshEditorUI();
			}
		});

		this.GetEditorId = function() {
			return editorId;
		}

		this.OnDestroy = function() {
			listener.UnlistenAll();
		}
	}

	function DialogScriptEditor(dialogId) {
		var listener = new EventListener(events);

		var editorId = dialogScriptEditorUniqueIdCounter;
		dialogScriptEditorUniqueIdCounter++;

		var scriptRoot, div, rootEditor;
		div = document.createElement("div");

		var self = this;

		var viewportDiv;
		var expressionBuilderDiv;

		function RefreshEditorUI() {
			div.innerHTML = "";
			scriptRoot = scriptNext.Compile(dialog[dialogId]);

			console.log(">>> SERIALIZE >>> \n" + scriptNext.Serialize(scriptRoot));

			rootEditor = createExpressionEditor(scriptRoot, self);

			viewportDiv = document.createElement("div");
			viewportDiv.classList.add("dialogContentViewport");
			// always selected so we can add actions to the root
			viewportDiv.classList.add("selectedEditor");
			viewportDiv.onclick = function() {
				// a hack to allow you to not have anything selected
				// if you click the background of the script editor
				// global curSelectedEditor is still a bit hacky :/
				if (curSelectedEditor != null) {
					curSelectedEditor.Deselect();
					curSelectedEditor = null;
				}
			}

			viewportDiv.appendChild(rootEditor.GetElement());
			div.appendChild(viewportDiv);

			expressionBuilderDiv = document.createElement("div");
			expressionBuilderDiv.classList.add("dialogExpressionBuilderHolder");
			expressionBuilderDiv.style.display = "none";
			div.appendChild(expressionBuilderDiv);
		}

		RefreshEditorUI();

		this.GetElement = function() {
			return div;
		}

		this.GetNode = function() {
			return scriptRoot;
		}

		function OnUpdate() {
			// scriptInterpreter.DebugVisualizeScriptTree(scriptRoot);

			var dialogStr = rootEditor.Serialize();

			if (dialogStr.indexOf("\n") > -1) {
				// hacky - expose the triple-quotes symbol somewhere?
				dialogStr = '"""\n' + dialogStr + '\n"""';
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

		listener.Listen("dialog_update", function(event) {
			if (event.dialogId === dialogId && event.editorId != editorId) {
				RefreshEditorUI();
			}
		});

		// TODO : remove these?
		/* root level creation functions for the dialog editor top-bar UI */
		this.AddDialog = function() {
			var printFunc = scriptUtils.CreateEmptyPrintFunc();
			rootEditor.GetNodes()[0].AddChild(printFunc); // hacky -- see note in action builder
			var editor = new DialogTextEditor([printFunc], rootEditor);
			rootEditor.AppendChild(editor);
			OnUpdate();
		}

		this.AddSequence = function() {
			var node = scriptUtils.CreateSequenceBlock();
			var editor = new SequenceEditor(node, rootEditor);
			rootEditor.AppendChild(editor);
			OnUpdate();
		}

		this.AddCycle = function() {
			var node = scriptUtils.CreateCycleBlock();
			var editor = new SequenceEditor(node, rootEditor);
			rootEditor.AppendChild(editor);
			OnUpdate();
		}

		this.AddShuffle = function() {
			var node = scriptUtils.CreateShuffleBlock();
			var editor = new SequenceEditor(node, rootEditor);
			rootEditor.AppendChild(editor);
			OnUpdate();
		}

		this.AddConditional = function() {
			var node = scriptUtils.CreateIfBlock();
			var editor = new ConditionalEditor(node, rootEditor);
			rootEditor.AppendChild(editor);
			OnUpdate();
		}

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
		}
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
		editor = new BlockEditor(expression, parent);
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
	else if (scriptNext.IsMathExpression(listType)) {
		editor = new MathExpressionEditor(expression, parent, isInline);
	}
	else {
		// todo : can anything else be inline??
		editor = new FunctionEditor(expression, parent, isInline);
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

function OrderControls(editor, parentEditor) {
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
		parentEditor.InsertChild(editor,insertIndex);
	}
	div.appendChild(moveUpButton);

	var moveDownButton = document.createElement("button");
	// moveDownButton.innerText = "down";
	moveDownButton.appendChild(iconUtils.CreateIcon("arrow_down"));
	moveDownButton.onclick = function() {
		var insertIndex = parentEditor.IndexOfChild(editor);
		parentEditor.RemoveChild(editor);
		insertIndex += 1;
		parentEditor.InsertChild(editor,insertIndex);
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
		if (parentEditor.ChildCount && parentEditor.ChildCount() > 1) {
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

var AddSelectionBehavior = (function() {
	// todo is this an ok way to create this global -- capture it in closure?
	var curSelectedEditor = null;

	return function (editor, onSelect, onDeselect, isInline) {
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
	}
})();

// todo : remove?
/* OLD UN-WRAPPED FUNCTIONS */
function addDialogBlockUI() {
	if (curDialogEditor != null) {
		curDialogEditor.AddDialog();
	}
}

function addSeqBlockUI() {
	if (curDialogEditor != null) {
		curDialogEditor.AddSequence();
	}
}

function addCycleBlock() {
	if (curDialogEditor != null) {
		curDialogEditor.AddCycle();
	}
}

function addShuffleBlock() {
	if (curDialogEditor != null) {
		curDialogEditor.AddShuffle();
	}
}

function addIfBlockUI() {
	if (curDialogEditor != null) {
		curDialogEditor.AddConditional();
	}
}

function ConvertNumberStringToArabic(numberString) {
	var arabicNumerals = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];

	var arabicNumberString = "";

	for (var i = 0; i < numberString.length; i++)
	{
		arabicNumberString += arabicNumerals[parseInt(numberString[i])];
	}

	return arabicNumberString;
}