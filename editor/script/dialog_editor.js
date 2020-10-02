/*
TODO dialog editor refactor:
- start by getting functions working
- need to support undescribed functions
- rename this root tool class? rename file?
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

	/* TitleWidget TODO
	- gameTextDir class
	- empty title mode
	- get rid of the duplicate preview and text input and just make the input readonly
	*/
	function TitleWidget() {
		var isMultiline = false;

		// is it bad to share the id counter with the other editors?
		var editorId = dialogScriptEditorUniqueIdCounter;
		dialogScriptEditorUniqueIdCounter++;

		var div = document.createElement("div");
		div.classList.add("titleWidget");

		var titleTextInput = document.createElement("input");
		titleTextInput.classList.add("textInputField");
		titleTextInput.type = "string";
		titleTextInput.placeholder = localization.GetStringOrFallback("title_placeholder", "Title");
		div.appendChild(titleTextInput);

		var openButton = document.createElement("button");
		openButton.classList.add("titleOpenDialog");
		openButton.title = "open title in dialog editor"; // todo : localize
		openButton.appendChild(iconUtils.CreateIcon("open_tool"));
		openButton.onclick = function() {
			events.Raise("select_dialog", { id: titleDialogId });
			alwaysShowDrawingDialog = document.getElementById("dialogAlwaysShowDrawingCheck").checked = false;
		}
		div.appendChild(openButton);

		function updateWidgetContent() {
			var titleLines = getTitle().split("\n");
			isMultiline = titleLines.length > 1;
			titleTextInput.value = (isMultiline ? titleLines[1] + "..." : titleLines[0]);
			titleTextInput.readOnly = isMultiline;
			openButton.style.display = isMultiline ? "flex" : "none";
		}

		titleTextInput.onchange = function() {
			setTitle(titleTextInput.value);
			refreshGameData();
			events.Raise("dialog_update", { dialogId:titleDialogId, editorId:editorId });
		}

		titleTextInput.onfocus = function() {
			if (!isMultiline) {
				openButton.style.display = "flex";
			}
		}

		titleTextInput.onblur = function() {
			if (!isMultiline) {
				setTimeout(function() {
					openButton.style.display = "none";
				}, 300); // the timeout is a hack to allow clicking the open button
			}
		}

		events.Listen("dialog_update", function(event) {
			if (event.dialogId === titleDialogId && event.editorId != editorId) {
				updateWidgetContent();
			}
		});

		events.Listen("game_data_change", function(event) {
			updateWidgetContent(); // TODO : only do this if the text actually changes?
		});

		updateWidgetContent();

		this.GetElement = function() {
			return div;
		}
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

	var dialogScriptEditorUniqueIdCounter = 0;

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

		var scriptRootNode, div, rootEditor;
		div = document.createElement("div");

		var self = this;

		var viewportDiv;
		var expressionBuilderDiv;

		function RefreshEditorUI() {
			div.innerHTML = "";
			scriptRootNode = scriptNext.Compile(dialog[dialogId]);

			console.log(">>> SERIALIZE >>> \n" + scriptNext.Serialize(scriptRootNode));

			rootEditor = new BlockEditor(scriptRootNode, self);

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
			return scriptRootNode;
		}

		function OnUpdate() {
			// scriptInterpreter.DebugVisualizeScriptTree(scriptRootNode);

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

	// todo : rename? dialogBlock? dialogExpression? dialogExpressionBlock? dialogList? dialogListBlock?
	function BlockEditor(dialogList, parentEditor) {
		var self = this;

		var div = document.createElement("div");
		div.classList.add("blockEditor");

		var childEditorRootDiv = document.createElement("div");
		div.appendChild(childEditorRootDiv);

		var actionBuilder = new ActionBuilder(this);
		div.appendChild(actionBuilder.GetElement());

		this.GetElement = function() {
			return div;
		}

		this.NotifyUpdate = function(hasNewChildren) {
			if (hasNewChildren) {
				UpdateNodeChildren();
			}

			parentEditor.NotifyUpdate();
		}

		this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
			parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
		}

		var childEditors = [];
		function CreateChildEditors() {
			// build the editors
			childEditors = [];

			var dialogExpressionList = [];
			function addText() {
				if (dialogExpressionList.length > 0) {
					var editor = new DialogTextEditor(dialogExpressionList, self);
					childEditors.push(editor);

					dialogExpressionList = [];
				}
			}

			for (var i = 1; i < dialogList.list.length; i++) {
				var expression = dialogList.list[i];

				var symbol = null;
				if (expression.type === "list" && expression.list[0].type === "symbol") {
					symbol = expression.list[0].value;
				}

				if (expression.type === "list" && !scriptNext.IsInlineFunction(symbol)) {
					addText();

					// todo : math and other special symbols
					// todo : access the special symbols from script module?
					if (scriptNext.IsSequence(symbol)) {
						var editor = new SequenceEditor(expression, self);
						childEditors.push(editor);
					}
					else if (scriptNext.IsConditional(symbol)) {
						var editor = new ConditionalEditor(expression, self);
						childEditors.push(editor);
					}
					else if (scriptNext.IsChoice(symbol)) {
						var editor = new ChoiceEditor(expression, self);
						childEditors.push(editor);
					}
					else if (scriptNext.IsDialogExpression(symbol)) {
						var editor = new BlockEditor(expression, self);
						childEditors.push(editor);
					}
					else if (scriptNext.IsMathExpression(symbol)) {
						var editor = new MathExpressionEditor(expression, self);
						childEditors.push(editor);
					}
					else {
						var editor = new FunctionEditor(expression, self);
						childEditors.push(editor);
					}
				}
				else {
					dialogExpressionList.push(expression);
				}
			}

			addText();
		}

		function RefreshChildUI() {
			childEditorRootDiv.innerHTML = "";

			for (var i = 0; i < childEditors.length; i++) {
				var editor = childEditors[i];
				childEditorRootDiv.appendChild(editor.GetElement());

				if (i < childEditors.length - 1) {
					var arrowHolder = document.createElement("div");
					arrowHolder.style.textAlign = "center";
					childEditorRootDiv.appendChild(arrowHolder);

					var svgArrow = document.createElement("img");
					svgArrow.src = "image/down_arrow.svg";
					svgArrow.style.margin = "5px";
					svgArrow.style.width = "20px";
					arrowHolder.appendChild(svgArrow);
				}
			}
		}

		function UpdateNodeChildren() {
			var updatedChildren = [];

			for (var i = 0; i < childEditors.length; i++) {
				var editor = childEditors[i];
				updatedChildren = updatedChildren.concat(editor.GetNodes());
			}

			blockNode.SetChildren(updatedChildren);
		}

		this.GetNodes = function() {
			return [blockNode];
		}

		this.Serialize = function() {
			return blockNode.Serialize();
		}

		this.RemoveChild = function(childEditor) {
			childEditors.splice(childEditors.indexOf(childEditor),1);
			RefreshChildUI();

			UpdateNodeChildren();

			parentEditor.NotifyUpdate();
		}

		this.IndexOfChild = function(childEditor) {
			return childEditors.indexOf(childEditor);
		}

		this.InsertChild = function(childEditor, index) {
			childEditors.splice(index, 0, childEditor);
			RefreshChildUI();

			UpdateNodeChildren();

			parentEditor.NotifyUpdate();
		}

		this.AppendChild = function(childEditor) {
			self.InsertChild(childEditor, childEditors.length);
		}

		this.ChildCount = function() {
			return childEditors.length;
		}

		this.OnNodeEnter = function(event) {
			for (var i = 0; i < childEditors.length; i++) {
				if (childEditors[i].OnNodeEnter) {
					childEditors[i].OnNodeEnter(event);
				}
			}
		}

		this.OnNodeExit = function(event) {
			for (var i = 0; i < childEditors.length; i++) {
				if (childEditors[i].OnNodeExit) {
					childEditors[i].OnNodeExit(event);
				}
			}
		}

		CreateChildEditors();
		RefreshChildUI();
	}

	function ActionBuilder(parentEditor) {
		var div = document.createElement("div");
		div.classList.add("actionBuilder");

		var addButton = document.createElement("button");
		addButton.classList.add("actionBuilderAdd");
		addButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
			+ localization.GetStringOrFallback("action_add_new", "add");
		addButton.onclick = function() {
			div.classList.add("actionBuilderActive");
			div.classList.add("actionBuilderRoot");
		}
		div.appendChild(addButton);

		var backButton = document.createElement("button");
		backButton.classList.add("actionBuilderButton");
		backButton.classList.add("actionBuilderButton_back");
		backButton.innerHTML = iconUtils.CreateIcon("previous").outerHTML + " "
			+ localization.GetStringOrFallback("action_back", "back");
		backButton.onclick = function() {
			div.classList.add("actionBuilderRoot");
			div.classList.remove(activeCategoryClass);
			activeCategoryClass = null;
		}
		div.appendChild(backButton);

		var activeCategoryClass = null;
		function makeActionCategoryButton(categoryName, text) {
			var actionCategoryButton = document.createElement("button");
			actionCategoryButton.classList.add("actionBuilderButton");
			actionCategoryButton.classList.add("actionBuilderCategory");
			actionCategoryButton.innerHTML = text + iconUtils.CreateIcon("next").outerHTML;
			actionCategoryButton.onclick = function() {
				div.classList.remove("actionBuilderRoot");
				activeCategoryClass = "actionBuilder_" + categoryName;
				div.classList.add(activeCategoryClass);
			}
			return actionCategoryButton;
		}

		div.appendChild(makeActionCategoryButton(
			"dialog",
			localization.GetStringOrFallback("dialog_action_category_dialog", "dialog")));
		div.appendChild(makeActionCategoryButton(
			"flow",
			localization.GetStringOrFallback("dialog_action_category_list", "lists")));
		div.appendChild(makeActionCategoryButton(
			"exit",
			localization.GetStringOrFallback("dialog_action_category_exit", "exit and ending actions")));
		div.appendChild(makeActionCategoryButton(
			"item",
			localization.GetStringOrFallback("dialog_action_category_item", "item and variable actions")));

		function makeActionBuilderButton(categoryName, text, createEditorFunc) {
			var actionBuilderButton = document.createElement("button");
			actionBuilderButton.classList.add("actionBuilderButton");
			actionBuilderButton.classList.add("actionBuilderButton_" + categoryName);
			actionBuilderButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " " + text;
			actionBuilderButton.onclick = function() {
				var editor = createEditorFunc();
				parentEditor.AppendChild(editor);
				div.classList.remove("actionBuilderActive");
				div.classList.remove(activeCategoryClass);
				activeCategoryClass = null;
			}
			return actionBuilderButton;
		}

		// TODO : localize these too! *** START FROM HERE ***
		div.appendChild(
			makeActionBuilderButton(
				"dialog",
				localization.GetStringOrFallback("dialog_block_basic", "dialog"),
				function() {
					var printFunc = scriptUtils.CreateEmptyPrintFunc();

					// hacky access of the parent node is required
					// because the print function needs to start with a parent
					// otherwise the dialog editor can't serialize the text D:
					parentEditor.GetNodes()[0].AddChild(printFunc);

					var editor = new DialogTextEditor([printFunc], parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"dialog",
				localization.GetStringOrFallback("function_pg_name", "pagebreak"),
				function() {
					var node = scriptUtils.CreateFunctionBlock("pg", []);
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"flow",
				localization.GetStringOrFallback("sequence_list_name", "sequence list"),
				function() {
					var node = scriptUtils.CreateSequenceBlock();
					var editor = new SequenceEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"flow",
				localization.GetStringOrFallback("cycle_list_name", "cycle list"),
				function() {
					var node = scriptUtils.CreateCycleBlock();
					var editor = new SequenceEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"flow",
				localization.GetStringOrFallback("shuffle_list_name", "shuffle list"),
				function() {
					var node = scriptUtils.CreateShuffleBlock();
					var editor = new SequenceEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"flow",
				localization.GetStringOrFallback("branching_list_name", "branching list"),
				function() {
					var node = scriptUtils.CreateIfBlock();
					var editor = new ConditionalEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"exit",
				localization.GetStringOrFallback("function_exit_name", "exit"),
				function() {
					var node = scriptUtils.CreateFunctionBlock("exit", ["0", 0, 0]);
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"exit",
				localization.GetStringOrFallback("function_end_name", "end"),
				function() {
					var node = scriptUtils.CreateFunctionBlock("end", []);
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"exit",
				localization.GetStringOrFallback("dialog_action_locked_set", "lock / unlock"),
				function() {
					var node = scriptUtils.CreatePropertyNode("locked", true);
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"item",
				localization.GetStringOrFallback("dialog_action_item_set", "set item count"),
				function() {
					var node = scriptUtils.CreateFunctionBlock("item", ["0", 10]);
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"item",
				localization.GetStringOrFallback("dialog_action_item_increase", "increase item count"),
				function() {
					var expressionNode = scriptInterpreter.CreateExpression('{item "0"} + 1');
					var codeBlock = scriptUtils.CreateCodeBlock();
					codeBlock.children.push(expressionNode);
					var node = scriptUtils.CreateFunctionBlock("item", ["0"]);
					node.children[0].args.push(codeBlock); // hacky
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"item",
				localization.GetStringOrFallback("dialog_action_item_decrease", "decrease item count"),
				function() {
					var expressionNode = scriptInterpreter.CreateExpression('{item "0"} - 1');
					var codeBlock = scriptUtils.CreateCodeBlock();
					codeBlock.children.push(expressionNode);
					var node = scriptUtils.CreateFunctionBlock("item", ["0"]);
					node.children[0].args.push(codeBlock); // hacky
					var editor = new FunctionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"item",
				localization.GetStringOrFallback("dialog_action_variable_set", "set variable value"),
				function() {
					var expressionNode = scriptInterpreter.CreateExpression("a = 5");
					var node = scriptUtils.CreateCodeBlock();
					node.children.push(expressionNode);
					var editor = new MathExpressionEditor(node, parentEditor);
					return editor;
				}));

		div.appendChild(
			makeActionBuilderButton(
				"item",
				localization.GetStringOrFallback("dialog_action_variable_change", "change variable value"),
				function() {
					var expressionNode = scriptInterpreter.CreateExpression("a = a + 1");
					var node = scriptUtils.CreateCodeBlock();
					node.children.push(expressionNode);
					var editor = new MathExpressionEditor(node, parentEditor);
					return editor;
				}));

		var cancelButton = document.createElement("button");
		cancelButton.classList.add("actionBuilderButton");
		cancelButton.classList.add("actionBuilderCancel");
		cancelButton.innerHTML = iconUtils.CreateIcon("cancel").outerHTML + " "
			+ localization.GetStringOrFallback("action_cancel", "cancel");
		cancelButton.onclick = function() {
			div.classList.remove("actionBuilderActive");
			div.classList.remove("actionBuilderRoot");
			if (activeCategoryClass != null) {
				div.classList.remove(activeCategoryClass);
				activeCategoryClass = null;
			}
		}
		div.appendChild(cancelButton);

		this.GetElement = function() {
			return div;
		}
	}

	// a bit hacky to have it as a global variable but it's nice that it remembers what you did!
	var globalShowTextEffectsControls = true;

	function DialogTextEditor(expressionList, parentEditor) {
		var div = document.createElement("div");
		div.classList.add("dialogEditor");
		div.classList.add("actionEditor");

		var orderControls = new OrderControls(this, parentEditor);
		div.appendChild(orderControls.GetElement());

		// var span = document.createElement("div");
		// span.innerText = "dialog";
		// div.appendChild(span);

		function OnDialogTextChange() {
			// hacky :(
			var scriptStr = '"""\n' +  textArea.value + '\n"""';
			var tempDialogNode = scriptInterpreter.Parse(scriptStr);
			expressionList = tempDialogNode.children;
			parentEditor.NotifyUpdate(true);
		}

		var textSelectionChangeHandler = createOnTextSelectionChange(OnDialogTextChange);
	
		var dialogText = scriptNext.SerializeWrapped(expressionList);

		var textHolderDiv = document.createElement("div");
		textHolderDiv.classList.add("dialogBoxContainer");

		var textArea = document.createElement("textarea");
		textArea.value = dialogText;

		textArea.onchange = OnDialogTextChange;
		textArea.onkeyup = OnDialogTextChange;
		textArea.onblur = OnDialogTextChange;

		textArea.rows = Math.max(2, dialogText.split("\n").length + 1);
		textArea.cols = 32;

		textArea.addEventListener('click', textSelectionChangeHandler);
		textArea.addEventListener('select', textSelectionChangeHandler);
		textArea.addEventListener('blur', textSelectionChangeHandler);

		textHolderDiv.appendChild(textArea);

		textHolderDiv.onclick = function() {
			textArea.focus(); // hijack focus into the actual textarea
		}

		div.appendChild(textHolderDiv);

		// add text effects controls
		var textEffectsDiv = document.createElement("div");
		textEffectsDiv.classList.add("controlBox");
		textEffectsDiv.style.display = "none";
		textEffectsDiv.style.marginTop = "10px"; // hacky
		div.appendChild(textEffectsDiv);

		var toggleTextEffectsButton = document.createElement("button");
		toggleTextEffectsButton.appendChild(iconUtils.CreateIcon("text_effects"));
		toggleTextEffectsButton.title = "show/hide text effects controls";
		toggleTextEffectsButton.onclick = function() {
			globalShowTextEffectsControls = !globalShowTextEffectsControls;
			textEffectsDiv.style.display = globalShowTextEffectsControls ? "block" : "none";
		}
		orderControls.GetCustomControlsContainer().appendChild(toggleTextEffectsButton);

		var textEffectsTitleDiv = document.createElement("div");
		textEffectsTitleDiv.style.marginBottom = "5px";
		textEffectsTitleDiv.innerHTML = iconUtils.CreateIcon("text_effects").outerHTML + " " + localization.GetStringOrFallback("dialog_effect_new", "text effects");
		textEffectsDiv.appendChild(textEffectsTitleDiv);

		var textEffectsControlsDiv = document.createElement("div");
		textEffectsControlsDiv.style.marginBottom = "5px";
		textEffectsDiv.appendChild(textEffectsControlsDiv);

		var effectsTags = ["{clr1}", "{clr2}", "{clr3}", "{wvy}", "{shk}", "{rbw}"];
		var effectsNames = [
			localization.GetStringOrFallback("dialog_effect_color1", "color 1"),
			localization.GetStringOrFallback("dialog_effect_color2", "color 2"),
			localization.GetStringOrFallback("dialog_effect_color3", "color 3"),
			localization.GetStringOrFallback("dialog_effect_wavy", "wavy"),
			localization.GetStringOrFallback("dialog_effect_shaky", "shaky"),
			localization.GetStringOrFallback("dialog_effect_rainbow", "rainbow"),
		];

		var effectsDescriptions = [
			"text in tags matches the 1st color in the palette",
			"text in tags matches the 2nd color in the palette",
			"text in tags matches the 3rd color in the palette",
			"text in tags waves up and down",
			"text in tags shakes constantly",
			"text in tags is rainbow colored"
		]; // TODO : localize

		function CreateAddEffectHandler(tag) {
			return function() {
				wrapTextSelection(tag); // hacky to still use this?
			}
		}

		for (var i = 0; i < effectsTags.length; i++) {
			var effectButton = document.createElement("button");
			effectButton.onclick = CreateAddEffectHandler(effectsTags[i]);
			effectButton.innerText = effectsNames[i];
			effectButton.title = effectsDescriptions[i];
			textEffectsControlsDiv.appendChild(effectButton);
		}

		var textEffectsPrintDrawingDiv = document.createElement("div");
		textEffectsDiv.appendChild(textEffectsPrintDrawingDiv);

		var textEffectsPrintDrawingButton = document.createElement("button");
		textEffectsPrintDrawingButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
			+ localization.GetStringOrFallback("dialog_effect_drawing", "insert drawing");
		textEffectsPrintDrawingButton.title = "draw a sprite, tile, or item in your dialog";
		textEffectsPrintDrawingDiv.appendChild(textEffectsPrintDrawingButton);

		var textEffectsPrintDrawingSelect = document.createElement("select");
		textEffectsPrintDrawingDiv.appendChild(textEffectsPrintDrawingSelect);

		for (id in object) {
			var option = document.createElement("option");

			var objectName = "";
			if (object[id].name) {
				objectName += object[id].name;
			}
			else if (getDrawingTypeFromId(id) == TileType.Avatar) {
				objectName += localization.GetStringOrFallback("avatar_label", "avatar");
			}
			else {
				if (getDrawingTypeFromId(id) == TileType.Sprite) {
					objectName += localization.GetStringOrFallback("sprite_label", "sprite");
				}
				else if (getDrawingTypeFromId(id) == TileType.Tile) {
					objectName += localization.GetStringOrFallback("tile_label", "tile");
				}
				else if (getDrawingTypeFromId(id) == TileType.Item) {
					objectName += localization.GetStringOrFallback("item_label", "item");
				}

				objectName += " " + id;
			}

			option.innerText = objectName;

			option.value = '{printSprite "' + id + '"}'; // TODO : replace with "printDrawing"

			textEffectsPrintDrawingSelect.appendChild(option);
		}

		textEffectsPrintDrawingButton.onclick = function() {
			textArea.value += textEffectsPrintDrawingSelect.value;

			OnDialogTextChange();
		}

		this.GetElement = function() {
			return div;
		}

		AddSelectionBehavior(
			this,
			function() { textEffectsDiv.style.display = globalShowTextEffectsControls ? "block" : "none"; },
			function() { textEffectsDiv.style.display = "none"; });

		this.GetNodes = function() {
			return expressionList;
		}

		this.OnNodeEnter = function(event) {
			if (event.id != undefined) {
				var enterIndex = expressionList.findIndex(function(node) { return node.GetId() === event.id });
				if (enterIndex == 0) {
					div.classList.add("executing");
				}
			}
		};

		this.OnNodeExit = function(event) {
			if (event.id != undefined) {
				var exitIndex = expressionList.findIndex(function(node) { return node.GetId() === event.id });
				if (exitIndex >= expressionList.length-1 || event.forceClear) {
					div.classList.remove("executing");
					div.classList.remove("executingLeave");
					void div.offsetWidth; // hack to force reflow to allow animation to restart
					div.classList.add("executingLeave");
					setTimeout(function() { div.classList.remove("executingLeave") }, 1100);
				}
			}
		};
	}

	function MathExpressionEditor(expression, parentEditor, isInline) {
		if (isInline === undefined || isInline === null) {
			isInline = false;
		}

		var self = this;

		var div = document.createElement(isInline ? "span" : "div");
		div.classList.add("actionEditor");
		div.classList.add("expressionEditor");
		if (isInline) {
			div.classList.add("inline");
		}

		var editExpressionButton = document.createElement("button");
		editExpressionButton.title = "edit expression"; // TODO : localize
		editExpressionButton.appendChild(iconUtils.CreateIcon("expression_edit"));
		editExpressionButton.onclick = function() {
			parentEditor.OpenExpressionBuilder(
				expressionRootNode.Serialize(),
				function(expressionNode) {
					expressionRootNode = expressionNode;
					if (node.type === "code_block" &&
						(node.children[0].type === "operator" ||
							node.children[0].type === "literal" ||
							node.children[0].type === "symbol")) {
						node.children[0] = expressionRootNode;
					}
					else {
						node = expressionRootNode;
					}
					CreateExpressionControls(true);
					parentEditor.NotifyUpdate();
				});
		};

		var editParameterTypes = false;
		var toggleParameterTypesButton = document.createElement("button");
		toggleParameterTypesButton.title = "toggle editing parameter types";
		toggleParameterTypesButton.appendChild(iconUtils.CreateIcon("settings"));
		toggleParameterTypesButton.onclick = function() {
			editParameterTypes = !editParameterTypes;
			CreateExpressionControls(true);
		}

		if (!isInline) {
			var orderControls = new OrderControls(this, parentEditor);
			div.appendChild(orderControls.GetElement());

			var customControls = orderControls.GetCustomControlsContainer();
			customControls.appendChild(editExpressionButton);
			customControls.appendChild(toggleParameterTypesButton);
		}

		var expressionSpan = document.createElement("span");
		expressionSpan.style.display = "inline-flex";
		div.appendChild(expressionSpan);

		function CreateExpressionControls(isEditable) {
			expressionSpan.innerHTML = "";

			AddOperatorControlRecursive(expression, isEditable);

			if (isInline && isEditable) {
				var editExpressionButtonSpan = document.createElement("span");
				editExpressionButtonSpan.classList.add("inlineEditButtonHolder");
				editExpressionButtonSpan.appendChild(editExpressionButton);
				expressionSpan.appendChild(editExpressionButtonSpan);
			}
		}

		function AddOperatorControlRecursive(expression, isEditable) {
			// left expression
			if (expression.list[1].type === "list" && scriptNext.IsMathExpression(expression.list[1].value)) {
				AddOperatorControlRecursive(expression.list[1], isEditable);
			}
			else {
				var parameterEditor = new ParameterEditor(
					["number", "string", "boolean", "symbol", "list"],
					function() { 
						return expression.list[1];
					},
					function(argExpression) {
						expression.list[1] = argExpression;
						parentEditor.NotifyUpdate();
					},
					isEditable,
					editParameterTypes,
					function(expressionString, onAcceptHandler) {
						parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
					});

				expressionSpan.appendChild(parameterEditor.GetElement());
			}

			// operator
			var operatorEditor = new ExpressionOperatorEditor(expression, self, isEditable);
			expressionSpan.appendChild(operatorEditor.GetElement());

			// right expression
			if (expression.list[2].type === "list" && scriptNext.IsMathExpression(expression.list[2].value)) {
				AddOperatorControlRecursive(expression.list[2].right, isEditable);
			}
			else {
				var parameterEditor = new ParameterEditor(
					["number", "string", "boolean", "symbol", "list"],
					function() {
						return expression.list[2].right;
					},
					function(argExpression) {
						expression.list[2] = argExpression;
						parentEditor.NotifyUpdate();
					},
					isEditable,
					editParameterTypes,
					function(expressionString, onAcceptHandler) {
						parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
					});

				expressionSpan.appendChild(parameterEditor.GetElement());
			}
		}

		CreateExpressionControls(false);

		this.GetElement = function() {
			return div;
		}

		AddSelectionBehavior(
			this,
			function() { CreateExpressionControls(true); },
			function() { CreateExpressionControls(false); },
			isInline);

		this.GetNodes = function() {
			// todo : re-implement?
			return [expression];
		}

		this.NotifyUpdate = function() {
			parentEditor.NotifyUpdate();
		}

		this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
			parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
		}
	}

	// hacky to duplicate these here!
	var comparisonOperators = {
		"IS" : "==",
		"GTE" : ">=",
		"LTE" : "<=",
		"GT" : ">",
		"LT" : "<",
	};

	var mathOperators = {
		"SUB" : "-",
		"ADD" : "+",
		"DIV" : "/",
		"MLT" : "*",
	};

	function ExpressionOperatorEditor(expression, parentEditor, isEditable) {
		var operatorSpan = document.createElement("span");
		operatorSpan.style.marginLeft = "5px";
		operatorSpan.style.marginRight = "5px";

		function CreateOperatorControl(isEditable) {
			operatorSpan.innerHTML = "";

			// use either the comparison operators or the math operators
			var operatorSymbol = expression.list[0].value;
			var operatorMap = operatorSymbol in comparisonOperators ? comparisonOperators : mathOperators;

			if (isEditable) {
				var operatorSelect = document.createElement("select");

				for (var symbol in operatorMap) {
					var operatorOption = document.createElement("option");
					operatorOption.value = operatorMap[symbol];
					operatorOption.innerText = symbol;
					operatorOption.selected = operatorMap[symbol] === operatorSymbol;
					operatorSelect.appendChild(operatorOption);
				}

				operatorSelect.onchange = function(event) {
					expression.list[0].value = event.target.value;
					parentEditor.NotifyUpdate();
				}

				operatorSpan.appendChild(operatorSelect);
			}
			else {
				operatorSpan.innerText = operatorMap[operatorSymbol];
			}
		}

		CreateOperatorControl(isEditable);

		this.GetElement = function() {
			return operatorSpan;
		}
	}

	var sequenceTypeDescriptionMap = {
		"SEQ" : {
			GetName : function() {
				return localization.GetStringOrFallback("sequence_list_name", "sequence list");
			},
			GetTypeName : function() {
				return localization.GetStringOrFallback("sequence_name", "sequence");
			},
			GetDescription : function() {
				return localization.GetStringOrFallback("sequence_list_description", "go through each item once in _:");
			},
		},
		"CYC" : {
			GetName : function() {
				return localization.GetStringOrFallback("cycle_list_name", "cycle list");
			},
			GetTypeName : function() {
				return localization.GetStringOrFallback("cycle_name", "cycle");
			},
			GetDescription : function() {
				return localization.GetStringOrFallback("cycle_list_description", "repeat items in a _:");
			},
		},
		"SHF" : {
			GetName : function() {
				return localization.GetStringOrFallback("shuffle_list_name", "shuffle list");
			},
			GetTypeName : function() {
				return localization.GetStringOrFallback("shuffle_name", "shuffle");
			},
			GetDescription : function() {
				return localization.GetStringOrFallback("shuffle_list_description", "_ items in a random order:");
			},
		},
	};

	function SequenceEditor(sequenceExpression, parentEditor) {
		var self = this;

		var div = document.createElement("div");
		div.classList.add("sequenceEditor");
		div.classList.add("actionEditor");

		var sequenceType = sequenceExpression.list[0].value;

		var orderControls = new OrderControls(this, parentEditor);
		div.appendChild(orderControls.GetElement());

		var titleDiv = document.createElement("div");
		titleDiv.classList.add("actionTitle");
		div.appendChild(titleDiv);

		var descriptionDiv = document.createElement("div");
		descriptionDiv.classList.add("sequenceDescription");
		div.appendChild(descriptionDiv);

		function CreateSequenceDescription(isEditable) {
			descriptionDiv.innerHTML = "";

			titleDiv.innerText = sequenceTypeDescriptionMap[sequenceType].GetName();

			var descriptionText = sequenceTypeDescriptionMap[sequenceType].GetDescription();
			var descriptionTextSplit = descriptionText.split("_");

			var descSpan1 = document.createElement("span");
			descSpan1.innerText = descriptionTextSplit[0];
			descriptionDiv.appendChild(descSpan1);

			if (isEditable) {
				var sequenceTypeSelect = document.createElement("select");
				for (var type in sequenceTypeDescriptionMap) {
					var typeName = sequenceTypeDescriptionMap[type].GetTypeName();
					var sequenceTypeOption = document.createElement("option");
					sequenceTypeOption.value = type;
					sequenceTypeOption.innerText = typeName;
					sequenceTypeOption.selected = (type === sequenceType);
					sequenceTypeSelect.appendChild(sequenceTypeOption);
				}
				sequenceTypeSelect.onchange = function() {
					// todo : reimplement
					// sequenceNode = scriptUtils.ChangeSequenceType(sequenceNode, sequenceTypeSelect.value);
					// node.SetChildren([sequenceNode]);
					// CreateSequenceDescription(true);
					parentEditor.NotifyUpdate();
				}
				descriptionDiv.appendChild(sequenceTypeSelect);
			}
			else {
				var sequenceTypeSpan = document.createElement("span");
				sequenceTypeSpan.classList.add("parameterUneditable");
				sequenceTypeSpan.innerText = sequenceTypeDescriptionMap[sequenceType].GetTypeName();
				descriptionDiv.appendChild(sequenceTypeSpan);
			}

			var descSpan2 = document.createElement("span");
			descSpan2.innerText = descriptionTextSplit[1];
			descriptionDiv.appendChild(descSpan2);
		}

		CreateSequenceDescription(false);

		var optionRootDiv = document.createElement("div");
		optionRootDiv.classList.add("optionRoot");
		div.appendChild(optionRootDiv);

		var addOptionRootDiv = document.createElement("div");
		addOptionRootDiv.classList.add("addOption");
		div.appendChild(addOptionRootDiv);

		var addOptionButton = document.createElement("button");
		addOptionButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
			+ localization.GetStringOrFallback("dialog_conditional_add", "add option"); // TODO : funny that this is the old conditional text
		addOptionButton.onclick = function() {
			var optionNode = scriptUtils.CreateOptionBlock();
			var optionEditor = new SequenceOptionEditor(optionNode, self);
			optionEditors.push(optionEditor);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}
		addOptionRootDiv.appendChild(addOptionButton);

		this.GetElement = function() {
			return div;
		}

		AddSelectionBehavior(
			this,
			function() { CreateSequenceDescription(true); }, /*onSelect*/
			function() { CreateSequenceDescription(false); } /*onDeselect*/ );

		this.GetNodes = function() {
			return [sequenceExpression];
		}

		this.NotifyUpdate = function() {
			parentEditor.NotifyUpdate();
		}

		this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
			parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
		}

		this.RemoveChild = function(childEditor) {
			optionEditors.splice(optionEditors.indexOf(childEditor),1);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}

		this.IndexOfChild = function(childEditor) {
			return optionEditors.indexOf(childEditor);
		}

		this.InsertChild = function(childEditor, index) {
			optionEditors.splice(index, 0, childEditor);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}

		this.ChildCount = function() {
			return optionEditors.length;
		}

		var optionEditors = [];
		function CreateOptionEditors() {
			optionEditors = [];

			for (var i = 1; i < sequenceExpression.list.length; i++) {
				var optionExpression = sequenceExpression.list[i];
				var optionEditor = new SequenceOptionEditor(optionExpression, self);
				optionEditor.SetOrderNumber(i+1);
				optionRootDiv.appendChild(optionEditor.GetElement());
				optionEditors.push(optionEditor);
			}
		}

		function RefreshOptionsUI() {
			optionRootDiv.innerHTML = "";
			for (var i = 0; i < optionEditors.length; i++) {
				var editor = optionEditors[i];
				editor.SetOrderNumber(i+1);
				optionRootDiv.appendChild(editor.GetElement());
			}
		}

		function UpdateNodeOptions() {
			var updatedOptions = [];

			for (var i = 0; i < optionEditors.length; i++) {
				var editor = optionEditors[i];
				updatedOptions = updatedOptions.concat(editor.GetNodes());
			}

			// TODO : reimplement
			// sequenceNode.SetChildren(updatedOptions);
		}

		CreateOptionEditors();

		this.OnNodeEnter = function(event) {
			if (event.id === expression.GetId()) {
				div.classList.add("executing");
			}

			for (var i = 0; i < optionEditors.length; i++) {
				if (optionEditors[i].OnNodeEnter) {
					optionEditors[i].OnNodeEnter(event);
				}
			}
		};

		// TODO : some kind of "visit all" functionality like the
		// script node system has would be super helpful...
		// in fact sharing the child - parent relationship code between the two
		// would make sense...
		this.OnNodeExit = function(event) {
			if (event.id === sequenceExpression.GetId() || event.forceClear) {
				div.classList.remove("executing");
				div.classList.remove("executingLeave");
				void div.offsetWidth; // hack to force reflow to allow animation to restart
				div.classList.add("executingLeave");
				setTimeout(function() { div.classList.remove("executingLeave") }, 1100);
			}

			for (var i = 0; i < optionEditors.length; i++) {
				if (optionEditors[i].OnNodeExit) {
					optionEditors[i].OnNodeExit(event);
				}
			}
		};
	}

	function SequenceOptionEditor(optionExpression, parentEditor) {
		var div = document.createElement("div");
		div.classList.add("optionEditor");

		var topControlsDiv = document.createElement("div");
		topControlsDiv.classList.add("optionControls");
		div.appendChild(topControlsDiv);

		var orderControls = new OrderControls(this, parentEditor);
		topControlsDiv.appendChild(orderControls.GetElement());

		var orderLabel = document.createElement("span");
		orderLabel.innerText = "#)";
		div.appendChild(orderLabel);

		// todo : handle non-dialog options? share with block editor?
		if (optionExpression.list[0].value === "->") {
			var blockEditor = new BlockEditor(optionExpression, parentEditor);
			div.appendChild(blockEditor.GetElement());			
		}

		this.GetElement = function() {
			return div;
		}

		this.GetNodes = function() {
			return [optionExpression];
		}

		this.SetOrderNumber = function(num) {
			var numString = "" + num;
			if (localization.GetLanguage() === "ar") { // arabic
				numString = ConvertNumberStringToArabic(numString);
			}
			orderLabel.innerText = numString + ")";
		}

		// just pass these on
		this.OnNodeEnter = function(event) {
			blockEditor.OnNodeEnter(event);
		}

		this.OnNodeExit = function(event) {
			blockEditor.OnNodeExit(event);
		}

		AddSelectionBehavior(this);
	}

	function ConditionalEditor(conditionalExpression, parentEditor) {
		var self = this;

		var div = document.createElement("div");
		div.classList.add("conditionalEditor");
		div.classList.add("actionEditor");

		var orderControls = new OrderControls(this, parentEditor);
		div.appendChild(orderControls.GetElement());

		var titleDiv = document.createElement("div");
		titleDiv.classList.add("actionTitle");
		titleDiv.innerText = localization.GetStringOrFallback("branching_list_name", "branching list");
		div.appendChild(titleDiv);

		var descriptionDiv = document.createElement("div");
		descriptionDiv.classList.add("sequenceDescription"); // hack
		descriptionDiv.innerText = localization.GetStringOrFallback("branching_list_description", "go to the first branch whose condition is true:");
		div.appendChild(descriptionDiv);

		var optionRootDiv = document.createElement("div");
		optionRootDiv.classList.add("optionRoot");
		div.appendChild(optionRootDiv);

		var addConditionRootDiv = document.createElement("div");
		addConditionRootDiv.classList.add("addOption");
		addConditionRootDiv.style.flexDirection = "column"; //hack
		div.appendChild(addConditionRootDiv);

		var addButton = document.createElement("button");
		addButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
			+ localization.GetStringOrFallback("branch_add", "add branch");
		addButton.onclick = function() {
			addButton.style.display = "none";
			addItemCondition.style.display = "block";
			addVariableCondition.style.display = "block";
			addDefaultCondition.style.display = "block";
			cancelButton.style.display = "block";
		}
		addConditionRootDiv.appendChild(addButton);

		var addItemCondition = document.createElement("button");
		addItemCondition.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
			+ localization.GetStringOrFallback("branch_type_item", "item branch");
		addItemCondition.style.display = "none";
		addItemCondition.onclick = function() {
			var conditionPairNode = scriptUtils.CreateItemConditionPair();
			var optionEditor = new ConditionalOptionEditor(conditionPairNode, self, optionEditors.length);
			optionEditors.push(optionEditor);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();

			addButton.style.display = "block";
			addItemCondition.style.display = "none";
			addVariableCondition.style.display = "none";
			addDefaultCondition.style.display = "none";
			cancelButton.style.display = "none";
		}
		addConditionRootDiv.appendChild(addItemCondition);

		var addVariableCondition = document.createElement("button");
		addVariableCondition.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
			+ localization.GetStringOrFallback("branch_type_variable", "variable branch");
		addVariableCondition.style.display = "none";
		addVariableCondition.onclick = function() {
			var conditionPairNode = scriptUtils.CreateVariableConditionPair();
			var optionEditor = new ConditionalOptionEditor(conditionPairNode, self, optionEditors.length);
			optionEditors.push(optionEditor);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();

			addButton.style.display = "block";
			addItemCondition.style.display = "none";
			addVariableCondition.style.display = "none";
			addDefaultCondition.style.display = "none";
			cancelButton.style.display = "none";
		}
		addConditionRootDiv.appendChild(addVariableCondition);

		var addDefaultCondition = document.createElement("button");
		addDefaultCondition.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
			+ localization.GetStringOrFallback("branch_type_default", "default branch");
		addDefaultCondition.style.display = "none";
		addDefaultCondition.onclick = function() {
			var conditionPairNode = scriptUtils.CreateDefaultConditionPair();
			var optionEditor = new ConditionalOptionEditor(conditionPairNode, self, optionEditors.length);
			optionEditors.push(optionEditor);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();

			addButton.style.display = "block";
			addItemCondition.style.display = "none";
			addVariableCondition.style.display = "none";
			addDefaultCondition.style.display = "none";
			cancelButton.style.display = "none";
		}
		addConditionRootDiv.appendChild(addDefaultCondition);

		var cancelButton = document.createElement("button");
		cancelButton.classList.add("actionBuilderButton");
		cancelButton.classList.add("actionBuilderCancel");
		cancelButton.innerHTML = iconUtils.CreateIcon("cancel").outerHTML + " "
			+ localization.GetStringOrFallback("action_cancel", "cancel");;
		cancelButton.style.display = "none";
		cancelButton.onclick = function() {
			addButton.style.display = "block";
			addItemCondition.style.display = "none";
			addVariableCondition.style.display = "none";
			addDefaultCondition.style.display = "none";
			cancelButton.style.display = "none";
		}
		addConditionRootDiv.appendChild(cancelButton);

		this.GetElement = function() {
			return div;
		}

		AddSelectionBehavior(this);

		this.GetNodes = function() {
			return [node];
		}

		this.NotifyUpdate = function() {
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}

		this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
			parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
		}

		this.RemoveChild = function(childEditor) {
			optionEditors.splice(optionEditors.indexOf(childEditor),1);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}

		this.IndexOfChild = function(childEditor) {
			return optionEditors.indexOf(childEditor);
		}

		this.InsertChild = function(childEditor, index) {
			optionEditors.splice(index, 0, childEditor);

			RefreshOptionsUI();
			UpdateNodeOptions();
			parentEditor.NotifyUpdate();
		}

		this.ChildCount = function() {
			return optionEditors.length;
		}

		var optionEditors = [];
		function CreateOptionEditors() {
			optionEditors = [];

			for (var i = 1; i < conditionalExpression.list.length; i += 2) {
				var conditionPair = conditionalExpression.list.slice(i, (i + 1) < conditionalExpression.list.length ? (i + 2) : (i + 1));
				var optionEditor = new ConditionalOptionEditor(conditionPair, self, i - 1);
				optionRootDiv.appendChild(optionEditor.GetElement());
				optionEditors.push(optionEditor);
			}
		}

		function RefreshOptionsUI() {
			optionRootDiv.innerHTML = "";
			for (var i = 0; i < optionEditors.length; i++) {
				var editor = optionEditors[i];
				editor.UpdateIndex(i);
				optionRootDiv.appendChild(editor.GetElement());
			}
		}

		// TODO : share w/ sequence editor?
		function UpdateNodeOptions() {
			// todo : reimplement
			// var updatedOptions = [];

			// for (var i = 0; i < optionEditors.length; i++) {
			// 	var editor = optionEditors[i];
			// 	updatedOptions = updatedOptions.concat(editor.GetNodes());
			// }

			// conditionalNode.SetChildren(updatedOptions);
		}

		CreateOptionEditors();

		this.OnNodeEnter = function(event) {
			if (event.id === node.GetId()) {
				div.classList.add("executing");
			}

			for (var i = 0; i < optionEditors.length; i++) {
				if (optionEditors[i].OnNodeEnter) {
					optionEditors[i].OnNodeEnter(event);
				}
			}
		};

		this.OnNodeExit = function(event) {
			if (event.id === node.GetId() || event.forceClear) {
				div.classList.remove("executing");
				div.classList.remove("executingLeave");
				void div.offsetWidth; // hack to force reflow to allow animation to restart
				div.classList.add("executingLeave");
				setTimeout(function() { div.classList.remove("executingLeave") }, 1100);
			}

			for (var i = 0; i < optionEditors.length; i++) {
				if (optionEditors[i].OnNodeExit) {
					optionEditors[i].OnNodeExit(event);
				}
			}
		};
	}

	function ConditionalOptionEditor(conditionPair, parentEditor, index) {
		var div = document.createElement("div");
		div.classList.add("optionEditor");

		var topControlsDiv = document.createElement("div");
		topControlsDiv.classList.add("optionControls");
		div.appendChild(topControlsDiv);

		var orderControls = new OrderControls(this, parentEditor);
		topControlsDiv.appendChild(orderControls.GetElement());

		// condition
		var comparisonExpression = conditionPair.length >= 2 ? conditionPair[0] : null;
		var comparisonEditor = new ConditionalComparisonEditor(comparisonExpression, this, index);
		div.appendChild(comparisonEditor.GetElement());

		// result
		var resultExpression = conditionPair.length >= 2 ? conditionPair[1] : conditionPair[0];
		if (resultExpression.list[0].value === "->") { // todo : non dialog results!
			var resultBlockEditor = new BlockEditor(resultExpression, this);
			div.appendChild(resultBlockEditor.GetElement());
		}

		this.GetElement = function() {
			return div;
		}

		this.GetNodes = function() {
			return conditionPair;
		}

		this.NotifyUpdate = function() {
			// TODO : reimplement

			// var updatedChildren = comparisonEditor.GetNodes().concat(resultBlockEditor.GetNodes());
			// conditionPairNode.SetChildren(updatedChildren);

			// parentEditor.NotifyUpdate();
		}

		this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
			parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
		}

		this.UpdateIndex = function(i) {
			index = i;
			comparisonEditor.UpdateIndex(index);
		}

		// just pass these on
		this.OnNodeEnter = function(event) {
			resultBlockEditor.OnNodeEnter(event);
		}

		this.OnNodeExit = function(event) {
			resultBlockEditor.OnNodeExit(event);
		}

		AddSelectionBehavior(
			this,
			function() { comparisonEditor.Select(); },
			function() { comparisonEditor.Deselect(); });
	}

	function ConditionalComparisonEditor(conditionExpression, parentEditor, index) {
		var self = this;

		var conditionStartSpan;
		var conditionEndSpan;
		var conditionExpressionEditor = null;

		var div = document.createElement("div");
		div.classList.add("conditionalComparisonEditor");

		function CreateComparisonControls() { // TODO : isEditable?
			div.innerHTML = "";

			conditionStartSpan = document.createElement("span");
			if (conditionExpression === null) {
				conditionStartSpan.innerText = localization.GetStringOrFallback("condition_else_label", "else");
			}
			else if (index === 0) {
				conditionStartSpan.innerText = localization.GetStringOrFallback("condition_if_label", "if") + " ";
			}
			else {
				conditionStartSpan.innerText = localization.GetStringOrFallback("condition_else_if_label", "else if") + " ";
			}
			div.appendChild(conditionStartSpan);

			// todo : what about just a value as the condition? etc...
			if (conditionExpression != null) {
				// todo : re-implement
				conditionExpressionEditor = new FunctionEditor(conditionExpression, self, true); // new ExpressionEditor(conditionNode, self, true);
				div.appendChild(conditionExpressionEditor.GetElement());
			}

			conditionEndSpan = document.createElement("span");
			if (conditionExpression != null) {
				conditionEndSpan.innerText = ", " + localization.GetStringOrFallback("condition_then_label", "then") + ":";
			}
			else {
				conditionEndSpan.innerText = ":";
			}
			div.appendChild(conditionEndSpan);
		}

		CreateComparisonControls();

		this.GetElement = function() {
			return div;
		}

		this.GetNodes = function() {
			// TODO : reimplement
			return [];


			// if (conditionNode.type === "else") {
			// 	return [conditionNode];
			// }
			// else {
			// 	return conditionExpressionEditor.GetNodes();
			// }
		}

		this.UpdateIndex = function(i) {
			// TODO : reimplement


			// index = i;

			// // update the initial label based on the order of the option
			// if (conditionNode.type != "else") {
			// 	if (index === 0) {
			// 		conditionStartSpan.innerText = localization.GetStringOrFallback("condition_if_label", "if") + " ";
			// 	}
			// 	else {
			// 		conditionStartSpan.innerText = localization.GetStringOrFallback("condition_else_if_label", "else if") + " ";
			// 	}
			// }
		}

		this.Select = function() {
			if (conditionExpressionEditor != null) {
				conditionExpressionEditor.Select();
			}
		}

		this.Deselect = function() {
			if (conditionExpressionEditor != null) {
				conditionExpressionEditor.Deselect();
			}
		}

		this.NotifyUpdate = function() {
			parentEditor.NotifyUpdate();
		}

		this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
			parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
		}
	}

	function ChoiceEditor(choiceExpression, parentEditor) {
		var self = this;

		var div = document.createElement("div");
		div.classList.add("choiceEditor");
		div.classList.add("actionEditor");

		var orderControls = new OrderControls(this, parentEditor);
		div.appendChild(orderControls.GetElement());

		var titleDiv = document.createElement("div");
		titleDiv.classList.add("actionTitle");
		titleDiv.innerText = "choice"; // TODO : localize
		div.appendChild(titleDiv);

		var descriptionDiv = document.createElement("div");
		descriptionDiv.classList.add("sequenceDescription"); // hack
		descriptionDiv.innerText = "let player pick from choices:"; // TODO : localize
		div.appendChild(descriptionDiv);

		var optionRootDiv = document.createElement("div");
		optionRootDiv.classList.add("optionRoot");
		div.appendChild(optionRootDiv);

		this.GetElement = function() {
			return div;
		}

		AddSelectionBehavior(this);

		var optionEditors = [];
		function CreateOptionEditors() {
			optionEditors = [];

			for (var i = 1; i < choiceExpression.list.length; i += 2) {
				var optionExpression = choiceExpression.list[i];
				var resultExpression = choiceExpression.list[i + 1];
				var optionEditor = new ChoiceOptionEditor(optionExpression, resultExpression, self, i - 1);
				optionRootDiv.appendChild(optionEditor.GetElement());
				optionEditors.push(optionEditor);
			}
		}

		CreateOptionEditors();
	}

	function ChoiceOptionEditor(choiceExpression, resultExpression, parentEditor, index) {
		var div = document.createElement("div");
		div.classList.add("optionEditor");

		var topControlsDiv = document.createElement("div");
		topControlsDiv.classList.add("optionControls");
		div.appendChild(topControlsDiv);

		var orderControls = new OrderControls(this, parentEditor);
		topControlsDiv.appendChild(orderControls.GetElement());

		var optionLabel = document.createElement("span");
		optionLabel.innerText = "if player picks:"; // todo : localize
		div.appendChild(optionLabel);

		// condition
		if (choiceExpression.list[0].value === "->") { // todo : non dialog choices? or is that an error?
			var choiceBlockEditor = new BlockEditor(choiceExpression, this);
			div.appendChild(choiceBlockEditor.GetElement());
		}

		var resultLabel = document.createElement("span");
		resultLabel.innerText = "then do:"; // todo : localize
		div.appendChild(resultLabel);

		// result
		if (resultExpression.list[0].value === "->") { // todo : non dialog results!
			var resultBlockEditor = new BlockEditor(resultExpression, this);
			div.appendChild(resultBlockEditor.GetElement());
		}

		this.GetElement = function() {
			return div;
		}
	}

	function RoomMoveDestinationCommand(functionNode, parentEditor, createFunctionDescriptionFunc) {
		var listener = new EventListener(events);

		var isMoving = false;

		var commandDescription = iconUtils.CreateIcon("set_exit_location").outerHTML + " "
			+ localization.GetStringOrFallback("exit_destination_move", "move destination");

		var moveCommand = document.createElement("div");

		var moveMessageSpan = document.createElement("span");
		moveCommand.appendChild(moveMessageSpan);

		var moveButton = document.createElement("button");
		moveButton.innerHTML = commandDescription;
		moveButton.title = "click to select new destination";
		moveButton.onclick = function() {
			isMoving = !isMoving;

			if (isMoving) {
				moveMessageSpan.innerHTML = "<i>" + localization.GetStringOrFallback("marker_move_click", "click in room") + "</i> ";
				moveButton.innerHTML = iconUtils.CreateIcon("cancel").outerHTML + " "
					+ localization.GetStringOrFallback("action_cancel", "cancel");
				events.Raise("disable_room_tool"); // TODO : don't know if I like this design
			}
			else {
				moveMessageSpan.innerHTML = "";
				moveButton.innerHTML = commandDescription;
				events.Raise("enable_room_tool");
			}
		}
		moveCommand.appendChild(moveButton);

		listener.Listen("click_room", function(event) {
			if (isMoving) {
				roomId = event.roomId;
				roomPosX = event.x;
				roomPosY = event.y;

				functionNode.args.splice(0, 1, scriptUtils.CreateStringLiteralNode(roomId));
				functionNode.args.splice(1, 1, scriptUtils.CreateLiteralNode(roomPosX));
				functionNode.args.splice(2, 1, scriptUtils.CreateLiteralNode(roomPosY));

				isMoving = false;
				moveMessageSpan.innerHTML = "";
				moveButton.innerHTML = commandDescription;

				createFunctionDescriptionFunc(true);
				parentEditor.NotifyUpdate();
				events.Raise("enable_room_tool");
			}
		});

		this.GetElement = function() {
			return moveCommand;
		}

		this.OnDestroy = function() {
			listener.UnlistenAll();
		}
	}

	// todo : rename since it's not just functions anymore?
	// todo : update for new names, new functions, etc
	var functionDescriptionMap = {
		"END" : {
			GetName : function() {
				return localization.GetStringOrFallback("function_end_name", "end");
			},
			GetDescription : function() {
				return localization.GetStringOrFallback("function_end_description", "stop the game");
			},
			GetHelpText : function() {
				return localization.GetStringOrFallback(
					"function_end_help",
					"the game stops immediately, but if there is dialog after this action, it will still play");
			},
			parameters : [],
		},
		"EXT" : {
			GetName : function() {
				return localization.GetStringOrFallback("function_exit_name", "exit");
			},
			GetDescription : function() {
				return localization.GetStringOrFallback("function_exit_description", "move player to _ at (_,_)[ with effect _]");
			},
			parameters : [
				{ types: ["room", "string", "symbol"], index: 0, name: "room", },
				{ types: ["number", "symbol"], index: 1, name: "x", },
				{ types: ["number", "symbol"], index: 2, name: "y", },
				{ types: ["transition", "string", "symbol"], index: 3, name: "transition effect", },
			],
			commands : [RoomMoveDestinationCommand],
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
				return localization.GetStringOrFallback("function_item_description", "_ in inventory[ = _]");
			},
			parameters : [
				{ types: ["item", "string", "symbol"], index: 0, name: "item", },
				{ types: ["number", "symbol"], index: 1, name: "amount", },
			],
		},
		// todo : reimplement as "special" thing for @
		// "property" : {
		// 	GetName : function() {
		// 		return localization.GetStringOrFallback("function_property_name", "property");
		// 	},
		// 	GetDescription : function() {
		// 		return localization.GetStringOrFallback("function_property_description", "property _[ = _]");
		// 	},
		// 	GetHelpText : function() { // TODO : when there's more than one property, this will have to change!
		// 		return localization.GetStringOrFallback(
		// 			"function_property_locked_example_help",
		// 			"change the value of a property: "
		// 			+ "for example, set the locked property to true to stop an exit from changing rooms, "
		// 			+ "or to prevent an ending from stopping the game");
		// 	},
		// 	parameters : [
		// 		{ types: ["symbol"], index: 0, name: "name", doNotEdit: true }, // NOTE: disable editing of property names for this version
		// 		{ types: ["number", "string", "boolean", "symbol"], index: 1, name: "value" },
		// 	],
		// },
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
		// todo : replace with special math expression editor???
		"IS" : {
			GetName : function() { return "equals"; }, // todo : localize
			GetDescription : function() { return "_ == _" }, // todo : localize
			parameters : [
				{ types: ["number", "boolean", "string", "symbol", "list"], index: 0, name: "left", },
				{ types: ["number", "boolean", "string", "symbol", "list"], index: 1, name: "right", },
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

	var isHelpTextOn = true;

	// TODO : support UNDESCRIBED functions! need a new editor?
	function FunctionEditor(expression, parentEditor, isInline) {
		if (isInline === undefined || isInline === null) {
			isInline = false;
		}

		var self = this;

		var fnSymbol = expression.list[0].value;
		var fnDescriptionId = fnSymbol in functionDescriptionMap ? fnSymbol : "default";
		var fnParamLength = expression.list.length - 1;

		var div = document.createElement(isInline ? "span" : "div");
		div.classList.add("functionEditor");
		div.classList.add("actionEditor");
		if (isInline) {
			div.classList.add("inline");
		}

		var orderControls = null;

		if (!isInline) {
			orderControls = new OrderControls(this, parentEditor);
			div.appendChild(orderControls.GetElement());
		}

		if (!isInline) {
			var titleText = functionDescriptionMap[fnDescriptionId].GetName();
			var titleDiv = document.createElement("div");
			titleDiv.classList.add("actionTitle");
			titleDiv.innerText = titleText;
			div.appendChild(titleDiv);
		}

		var descriptionDiv = document.createElement(isInline ? "span" : "div");
		div.appendChild(descriptionDiv);

		var customCommandsDiv = null;
		var addParameterDiv = null;
		var helpTextDiv = null;
		var helpTextContent = null;
		var hasHelpText = false;

		var editParameterTypes = false;
		var toggleParameterTypesButton = document.createElement("button");
		toggleParameterTypesButton.title = "toggle editing parameter types";
		toggleParameterTypesButton.appendChild(iconUtils.CreateIcon("settings"));
		toggleParameterTypesButton.onclick = function() {
			editParameterTypes = !editParameterTypes;
			CreateFunctionDescription(true);
		}

		if (!isInline) {
			customCommandsDiv = document.createElement("div");
			customCommandsDiv.style.marginTop = "5px"; // hack : need to hide these spacers...
			div.appendChild(customCommandsDiv);

			addParameterDiv = document.createElement("div");
			addParameterDiv.style.marginTop = "5px"; // hack
			div.appendChild(addParameterDiv);

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

			var helpTextFunc = functionDescriptionMap[fnDescriptionId].GetHelpText;
			hasHelpText = helpTextFunc != undefined && helpTextFunc != null;
			if (hasHelpText) {
				helpTextContent.innerText = helpTextFunc();
			}

			var toggleHelpButton = document.createElement("button");
			toggleHelpButton.title = "turn help text on/off";
			toggleHelpButton.appendChild(iconUtils.CreateIcon("help"));
			toggleHelpButton.onclick = function() {
				isHelpTextOn = !isHelpTextOn;

				// hacky
				if (hasHelpText && isHelpTextOn) {
					helpTextDiv.style.display = "flex";
				}
				else {
					helpTextDiv.style.display = "none";
				}
			}

			var customControls = orderControls.GetCustomControlsContainer();
			customControls.appendChild(toggleParameterTypesButton);

			if (hasHelpText) {
				customControls.appendChild(toggleHelpButton);
			}
		}

		// TODO : populate default values!!
		var curParameterEditors = [];
		var curCommandEditors = []; // store custom commands
		function CreateFunctionDescription(isEditable) {
			curParameterEditors = [];
			descriptionDiv.innerHTML = "";

			if (!isInline) {
				customCommandsDiv.innerHTML = "";
				addParameterDiv.innerHTML = "";
			}

			var descriptionText = functionDescriptionMap[fnDescriptionId].GetDescription();
			var descriptionTextSplit = descriptionText.split("_");

			function createGetArgFunc(expression, parameterIndex) {
				return function() {
					return expression.list[parameterIndex + 1];
				};
			}

			function createSetArgFunc(expression, parameterIndex, parentEditor) {
				return function(newParam) {
					expression.list.splice(parameterIndex, 1, newParam);
					parentEditor.NotifyUpdate();
				};
			}

			var i = 0;

			for (; i < descriptionTextSplit.length; i++) {
				var descriptionSpan = document.createElement("span");
				descriptionDiv.appendChild(descriptionSpan);

				var text = descriptionTextSplit[i];
				if (text.indexOf("[") >= 0) { // optional parameter text start
					var optionalTextStartSplit = text.split("[");
					descriptionSpan.innerText = optionalTextStartSplit[0];
					var nextParam = functionDescriptionMap[fnDescriptionId].parameters[i];
					if (fnParamLength > nextParam.index && optionalTextStartSplit.length > 1) {
						descriptionSpan.innerText += optionalTextStartSplit[1];
					}
				}
				else if (text[text.length - 1] === "]") { // optional parameter text end
					var prevParam = functionDescriptionMap[fnDescriptionId].parameters[i-1];
					if (fnParamLength > prevParam.index) {
						descriptionSpan.innerText = text.slice(0, text.length - 1);
					}
				}
				else { // regular description text
					descriptionSpan.innerText = text;
				}

				if (i < descriptionTextSplit.length - 1) {
					var parameterInfo = functionDescriptionMap[fnDescriptionId].parameters[i];

					if (fnParamLength > parameterInfo.index) {
						var parameterEditor = new ParameterEditor(
							parameterInfo.types.concat(["list"]),
							createGetArgFunc(expression, parameterInfo.index),
							createSetArgFunc(expression, parameterInfo.index, self),
							isEditable && !(parameterInfo.doNotEdit),
							!isInline && editParameterTypes,
							function(expressionString, onAcceptHandler) {
								parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
							});

						curParameterEditors.push(parameterEditor);
						descriptionDiv.appendChild(parameterEditor.GetElement());
					}
					else if (!isInline && isEditable && fnParamLength == parameterInfo.index && parameterInfo.name) {
						function createAddParameterHandler(expression, parameterInfo) {
							return function() {
								expression.list.push(CreateDefaultArgNode(parameterInfo.types[0]));
								CreateFunctionDescription(true);
								parentEditor.NotifyUpdate();
							}
						}

						var addParameterButton = document.createElement('button');
						addParameterButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + parameterInfo.name;
						addParameterButton.onclick = createAddParameterHandler(expression, parameterInfo);
						addParameterDiv.appendChild(addParameterButton);
					}
				}
			}

			// add any additional parameters that go beyond the defined description
			i -= (fnDescriptionId === "default" ? 2 : 1); // ok this is pretty awkward to me
			var inputSeperator = " ";

			for (; i < fnParamLength; i++) {
				var spaceSpan = document.createElement("span");
				spaceSpan.innerText = inputSeperator;
				descriptionDiv.appendChild(spaceSpan);

				var parameterEditor = new ParameterEditor(
					["number", "string", "boolean", "symbol", "list"],
					createGetArgFunc(expression, i),
					createSetArgFunc(expression, i, self),
					isEditable,
					!isInline && editParameterTypes,
					function(expressionString, onAcceptHandler) {
						parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
					});

				curParameterEditors.push(parameterEditor);
				descriptionDiv.appendChild(parameterEditor.GetElement());

				inputSeperator = ", ";
			}


			if (!isInline) {
				// clean up and reset command editors
				for (var i = 0; i < curCommandEditors.length; i++) {
					curCommandEditors[i].OnDestroy();
				}
				curCommandEditors = [];

				// add custom edit commands
				var commands = functionDescriptionMap[fnDescriptionId].commands;
				if (isEditable && commands) {
					for (var i = 0; i < commands.length; i++) {
						var commandEditor = new commands[i](expression, parentEditor, CreateFunctionDescription);
						curCommandEditors.push(commandEditor);
						customCommandsDiv.appendChild(commandEditor.GetElement());
					}
				}

				if (isEditable && hasHelpText && isHelpTextOn) {
					helpTextDiv.style.display = "flex";
				}
				else {
					helpTextDiv.style.display = "none";
				}
			}
		}

		CreateFunctionDescription(false);

		this.GetElement = function() {
			return div;
		}

		this.GetNodes = function() {
			return [node];
		}

		this.NotifyUpdate = function() {
			parentEditor.NotifyUpdate();
		}

		this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
			parentEditor.OpenExpressionBuilder(expressionString, onAcceptHandler);
		}

		AddSelectionBehavior(
			this,
			function() { CreateFunctionDescription(true); }, /*onSelect*/
			function() { /*onDeselect*/
				for (var i = 0; i < curParameterEditors.length; i++) {
					if (curParameterEditors[i].Deselect) {
						curParameterEditors[i].Deselect();
					}
				}

				CreateFunctionDescription(false);
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

	function CreateDefaultArgNode(type) {
		var argNode;
		if (type === "number") {
			// todo : replace these with helper function from script module?
			argNode = { type: "number", value: 0 };
		}
		else if (type === "string") {
			argNode = { type: "string", value: "" };
		}
		else if (type === "boolean") {
			argNode = { type: "boolean", value: true };
		}
		else if (type === "symbol") {
			argNode = { type: "symbol", value: "a" }; // TODO : find first var instead?
		}
		else if (type === "list") {
			// todo : I recreated the old logic for this but is this still what we want?
			argNode = [{ type: "symbol", value: "item" }, { type: "symbol", value: "0" }];
		}
		else if (type === "room") {
			argNode = { type: "symbol", value: "0" }; // TODO : find first room instead?
		}
		else if (type === "item") {
			argNode = { type: "symbol", value: "0" }; // TODO : find first item instead?
		}
		else if (type === "transition") {
			argNode = { type: "string", value: "fade_w" };
		}
		return argNode;
	}

	function GetColorClassForParameterType(type) {
		if (type === "number") {
			return "pinkColor";
		}
		else if (type === "string") {
			return "greenColor";
		}
		else if (type === "boolean") {
			return "greenColor";
		}
		else if (type === "symbol") {
			return "goldColor";
		}
		else if (type === "room") {
			return "greenColor";
		}
		else if (type === "item") {
			return "greenColor";
		}
		else if (type === "transition") {
			return "greenColor";
		}
	}

	// for rendering item thumbnails
	var thumbnailRenderer = CreateDrawingThumbnailRenderer();

	// TODO : put in shared location?
	var transitionTypes = [
		{
			GetName: function() { return localization.GetStringOrFallback("transition_fade_w", "fade (white)"); },
			id: "fade_w",
		},
		{
			GetName: function() { return localization.GetStringOrFallback("transition_fade_b", "fade (black)"); },
			id: "fade_b",
		},
		{
			GetName: function() { return localization.GetStringOrFallback("transition_wave", "wave"); },
			id: "wave",
		},
		{
			GetName: function() { return localization.GetStringOrFallback("transition_tunnel", "tunnel"); },
			id: "tunnel",
		},
		{
			GetName: function() { return localization.GetStringOrFallback("transition_slide_u", "slide up"); },
			id: "slide_u",
		},
		{
			GetName: function() { return localization.GetStringOrFallback("transition_slide_d", "slide down"); },
			id: "slide_d",
		},
		{
			GetName: function() { return localization.GetStringOrFallback("transition_slide_l", "slide left"); },
			id: "slide_l",
		},
		{
			GetName: function() { return localization.GetStringOrFallback("transition_slide_r", "slide right"); },
			id: "slide_r",
		},
	];

	function ParameterEditor(parameterTypes, getArgFunc, setArgFunc, isEditable, isTypeEditable, openExpressionBuilderFunc) {
		var self = this;

		var curType;

		var span = document.createElement("span");
		span.classList.add("parameterEditor");

		function UpdateEditor(type) {
			curType = type;
			var curValue = GetValue();

			span.innerHTML = "";

			if (isEditable) {
				var parameterEditable = document.createElement("span");
				parameterEditable.classList.add("parameterEditable");

				if (isTypeEditable) {
					var typeSelect = document.createElement("select");
					parameterEditable.appendChild(typeSelect);
					for (var i = 0; i < parameterTypes.length; i++) {
						var typeOption = document.createElement("option");
						typeOption.value = parameterTypes[i];
						typeOption.innerText = parameterTypes[i]; // TODO : localize
						typeOption.selected = curType === parameterTypes[i];
						typeSelect.appendChild(typeOption);
					}

					typeSelect.onchange = function(event) {
						ChangeEditorType(event.target.value);
					}
				}

				var parameterInput = CreateInput(curType, curValue, setArgFunc);
				parameterEditable.appendChild(parameterInput);

				span.appendChild(parameterEditable);
			}
			else {
				var parameterValue = document.createElement("span");
				parameterValue.classList.add("parameterUneditable");
				parameterValue.classList.add(GetColorClassForParameterType(type));
				span.appendChild(parameterValue);

				if (type === "room") {
					parameterValue.innerText = GetRoomNameFromId(curValue);
				}
				else if (type === "item") {
					parameterValue.innerText = GetItemNameFromId(curValue);

					// only try to render the item if it actually exists!
					if (item.hasOwnProperty(curValue)) {
						var itemThumbnail = document.createElement("img");
						span.appendChild(itemThumbnail);
						itemThumbnail.id = "param_item_" + curValue;
						itemThumbnail.style.width = "16px";
						itemThumbnail.style.marginLeft = "4px";
						thumbnailRenderer.Render(curValue, function(uri) { itemThumbnail.src = uri; }, { isAnimated: false });
					}
				}
				else if (type === "transition") {
					// TODO : kind of using the loop in a weird way
					for (var i = 0; i < transitionTypes.length; i++) {
						var id = transitionTypes[i].id;
						if (id === curValue) {
							parameterValue.innerText = transitionTypes[i].GetName();
						}
					}
				}
				else if (type === "list") {
					var inlineFunctionEditor = TryCreateFunctionEditor();
					if (inlineFunctionEditor != null) {
						parameterValue.appendChild(inlineFunctionEditor.GetElement());
					}
					else {
						// just in case
						parameterValue.innerText = "ERROR"; // todo : can this be handled better?
					}
				}
				// todo : handle lists for special forms, and for math expressions
				else if (type === "string") {
					parameterValue.innerText = '"' + curValue + '"';
				}
				else {
					parameterValue.innerText = curValue;
				}
			}
		}

		function TryCreateFunctionEditor() {
			var inlineFunctionEditor = null;
			var funcExpression = getArgFunc();
			if (funcExpression.type === "list") {
				inlineFunctionEditor = new FunctionEditor(getArgFunc(), self, true);
			}
			return inlineFunctionEditor;
		}

		function TryCreateExpressionEditor() {
			var inlineExpressionEditor = null;
			var expressionNode = getArgFunc();
			if (expressionNode.type === "code_block" && 
				(expressionNode.children[0].type === "operator" || 
					expressionNode.children[0].type === "literal" ||
					expressionNode.children[0].type === "symbol")) {
				inlineExpressionEditor = new MathExpressionEditor(expressionNode, self, true);
			}
			return inlineExpressionEditor;
		}

		function ChangeEditorType(type) {
			SetArgToDefault(type);
			UpdateEditor(type);
		}

		function SetArgToDefault(type) {
			setArgFunc(CreateDefaultArgNode(type));
		}

		function CreateInput(type, value, onChange) {
			var parameterInput;

			if (type === "number") {
				parameterInput = document.createElement("input");
				parameterInput.type = "number";
				parameterInput.min = 0;
				parameterInput.step = "any";
				parameterInput.value = value;
				parameterInput.onchange = function(event) {
					var val = event.target.value;
					var argNode = scriptUtils.CreateLiteralNode(val);
					onChange(argNode);
				}
			}
			else if (type === "string") {
				parameterInput = document.createElement("input");
				parameterInput.type = "string";
				parameterInput.value = value;
				parameterInput.onchange = function(event) {
					var val = event.target.value;
					var argNode = scriptUtils.CreateStringLiteralNode(val);
					onChange(argNode);
				}
			}
			else if (type === "boolean") {
				parameterInput = document.createElement("select");

				var boolTrueOption = document.createElement("option");
				boolTrueOption.value = "YES";
				boolTrueOption.innerText = "YES"; // TODO : localize
				boolTrueOption.selected = value;
				parameterInput.appendChild(boolTrueOption);

				var boolFalseOption = document.createElement("option");
				boolFalseOption.value = "NO";
				boolFalseOption.innerText = "NO"; // TODO : localize
				boolFalseOption.selected = !value;
				parameterInput.appendChild(boolFalseOption);

				parameterInput.onchange = function(event) {
					var val = event.target.value;
					var argNode = scriptUtils.CreateLiteralNode(val);
					onChange(argNode);
				}
			}
			else if (type === "symbol") {
				parameterInput = document.createElement("span");

				var variableInput = document.createElement("input");
				variableInput.type = "string";
				variableInput.setAttribute("list", "variable_datalist");
				variableInput.value = value;
				parameterInput.appendChild(variableInput);
				
				var variableDatalist = document.createElement("datalist");
				variableDatalist.id = "variable_datalist"; // will duplicates break this?
				for (var name in variable) {
					var variableOption = document.createElement("option");
					variableOption.value = name;
					variableDatalist.appendChild(variableOption);
				}
				parameterInput.appendChild(variableDatalist);

				variableInput.onchange = function(event) {
					var val = event.target.value;
					var argNode = scriptUtils.CreateVariableNode(val);
					onChange(argNode);
				}
			}
			else if (type === "room") {
				parameterInput = document.createElement("select");
				parameterInput.title = "choose room";

				for (id in room) {
					var roomOption = document.createElement("option");
					roomOption.value = id;
					roomOption.innerText = GetRoomNameFromId(id);
					roomOption.selected = id === value;
					parameterInput.appendChild(roomOption);
				}

				parameterInput.onchange = function(event) {
					var val = event.target.value;
					var argNode = scriptUtils.CreateStringLiteralNode(val);
					onChange(argNode);
				}
			}
			else if (type === "item") {
				parameterInput = document.createElement("select");
				parameterInput.title = "choose item";

				for (id in item) {
					var itemOption = document.createElement("option");
					itemOption.value = id;
					itemOption.innerText = GetItemNameFromId(id);
					itemOption.selected = id === value;
					parameterInput.appendChild(itemOption);
				}

				parameterInput.onchange = function(event) {
					var val = event.target.value;
					var argNode = scriptUtils.CreateStringLiteralNode(val);
					onChange(argNode);
				}
			}
			else if (type === "transition") {
				parameterInput = document.createElement("select");
				parameterInput.title = "select transition effect";

				for (var i = 0; i < transitionTypes.length; i++) {
					var id = transitionTypes[i].id;
					var transitionOption = document.createElement("option");
					transitionOption.value = id;
					transitionOption.innerText = transitionTypes[i].GetName();
					transitionOption.selected = id === value;
					parameterInput.appendChild(transitionOption);
				}

				parameterInput.onchange = function(event) {
					var val = event.target.value;
					var argNode = scriptUtils.CreateStringLiteralNode(val);
					onChange(argNode);
				}
			}
			else if (type === "list") {
				parameterInput = document.createElement("span");
				var inlineFunctionEditor = TryCreateFunctionEditor();
				if (inlineFunctionEditor != null) {
					inlineFunctionEditor.Select();
					parameterInput.appendChild(inlineFunctionEditor.GetElement());
				}
				else {
					// just in case
					parameterInput.classList.add("parameterUneditable");
					parameterInput.innerText = value;
				}
			}
			else if (type === "list") {
				parameterInput = document.createElement("span");
				var inlineExpressionEditor = TryCreateExpressionEditor();
				if (inlineExpressionEditor != null) {
					inlineExpressionEditor.Select();
					parameterInput.appendChild(inlineExpressionEditor.GetElement());
				}
				else {
					parameterInput.classList.add("parameterUneditable");
					parameterInput.innerText = value;
				}
			}

			return parameterInput;
		}

		function GetValue() {
			var arg = getArgFunc();
			if (arg.type === "number" || arg.type === "string" || arg.type === "boolean" || arg.type === "symbol") {
				return scriptNext.SerializeValue(arg.value, arg.type);
			}
			else if (arg.type === "list") {
				return "LIST"; // arg.list; // todo : re-implement this
			}

			return null;
		}

		function DoesEditorTypeMatchNode(type, node) {
			if (type === "boolean" && node.value === null) {
				// todo : keep this catch all for weird cases?
				return true;
			}
			else if (type === "number" && node.type === "number" && (typeof node.value) === "number") {
				return true;
			}
			else if (type === "string" && node.type === "string" && (typeof node.value) === "string") {
				return true;
			}
			else if (type === "boolean" && node.type === "boolean" && (typeof node.value) === "boolean") {
				return true;
			}
			else if (type === "symbol" && node.type === "symbol") {
				return true;
			}
			else if (type === "room" && node.type === "string" && (typeof node.value) === "string" && node.value in room) {
				return true;
			}
			else if (type === "item" && node.type === "string" && (typeof node.value) === "string" && node.value in item) {
				return true;
			}
			else if (type === "transition" && node.type === "string" && (typeof node.value) === "string") {
				return true;
			}
			else if (type === "list" && node.type === "list") {
				return true;
			}

			return false;
		}

		// edit parameter with the first matching type this parameter supports
		var curType = parameterTypes[0];
		for (var i = 0; i < parameterTypes.length; i++) {
			if (DoesEditorTypeMatchNode(parameterTypes[i], getArgFunc())) {
				curType = parameterTypes[i];
				break;
			}
		}

		UpdateEditor(curType);

		this.GetElement = function() {
			return span;
		}

		this.NotifyUpdate = function() {
			// hack to force an update
			setArgFunc(getArgFunc());
		}

		this.OpenExpressionBuilder = function(expressionString, onAcceptHandler) {
			if (openExpressionBuilderFunc) {
				openExpressionBuilderFunc(expressionString, onAcceptHandler);
			}
		}
	}

	function GetItemNameFromId(id) {
		if (!item[id]) {
			return "";
		}

		return (item[id].name != null ? item[id].name : localization.GetStringOrFallback("item_label", "item") + " " + id);
	}

	function GetRoomNameFromId(id) {
		if (!room[id]) {
			return "";
		}

		return (room[id].name != null ? room[id].name : localization.GetStringOrFallback("room_label", "room") + " " + id);
	}

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

	var curSelectedEditor = null;
	function AddSelectionBehavior(editor, onSelect, onDeselect, isInline) {
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

	/* EXPRESSION BUILDER
		TODO :
		- move into its own file?
		- name vs expression editor? kind of confusing
		- add protections against messing up using the assignment operator "="
		- probably general protections against using the buttons wrong would help
	*/
	function ExpressionBuilder(expressionString, parentEditor, onCancelHandler, onAcceptHandler) {
		var expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

		var div = document.createElement("div");
		div.classList.add("expressionBuilder");

		var expressionDiv = document.createElement("div");
		expressionDiv.classList.add("expressionEditorRoot");
		div.appendChild(expressionDiv);
		var expressionEditor = new MathExpressionEditor(expressionRootNode, parentEditor, true);
		expressionDiv.appendChild(expressionEditor.GetElement());
		var curNumberSpan = document.createElement("span");
		curNumberSpan.classList.add(GetColorClassForParameterType("number"));
		curNumberSpan.style.borderRadius = "2px";
		expressionDiv.appendChild(curNumberSpan);

		var numericInputRoot = document.createElement("div");
		numericInputRoot.classList.add("expressionBuilderInputs");
		div.appendChild(numericInputRoot);

		var curNumberBeforeDecimal = "";
		var curNumberAfterDecimal = "";
		var curNumberHasDecimal = false;
		function CreateNumberInputHandler(number) { // TODO : uppercase function name?
			return function() {
				if (number === ".") {
					curNumberHasDecimal = true;
				}
				else if (curNumberHasDecimal) {
					curNumberAfterDecimal += number;
				}
				else {
					curNumberBeforeDecimal += number;
				}

				var curNumberString = "";
				curNumberString += curNumberBeforeDecimal.length > 0 ? curNumberBeforeDecimal : "0";
				curNumberString += curNumberHasDecimal ? "." : "";
				curNumberString += curNumberHasDecimal ? (curNumberAfterDecimal.length > 0 ? curNumberAfterDecimal : "0") : "";

				curNumberSpan.innerText = curNumberString;
			}
		}

		function TryAddCurrentNumberToExpression() {
			if (curNumberSpan.innerText.length > 0) {
				var expressionString = expressionRootNode.Serialize();
				expressionString += " " + curNumberSpan.innerText;
				expressionRootNode = scriptInterpreter.CreateExpression(expressionString);
			}
			// TODO : clear the number?
		}

		var numberRoot = document.createElement("div");
		numberRoot.style.flexGrow = "3";
		numberRoot.style.display = "flex";
		numberRoot.style.flexDirection = "column";
		numberRoot.style.marginRight = "10px";
		numericInputRoot.appendChild(numberRoot);

		var numberInputs = [["7","8","9"],["4","5","6"],["1","2","3"],["0",".","_"]];
		for (var i = 0; i < numberInputs.length; i++) {
			var numberInputRowDiv = document.createElement("div");
			numberInputRowDiv.style.flexGrow = "1";
			numberInputRowDiv.style.display = "flex";
			numberRoot.appendChild(numberInputRowDiv);
			var numberInputRow = numberInputs[i];

			for (var j = 0; j < numberInputRow.length; j++) {
				var button = document.createElement("button");
				button.classList.add(GetColorClassForParameterType("number"));
				button.innerText = numberInputs[i][j];
				button.style.flexGrow = "1";
				button.onclick = CreateNumberInputHandler(numberInputs[i][j]);

				// hack
				if (numberInputs[i][j] === "_") {
					button.disabled = true;
					button.style.background = "white";
					button.style.color = "white";
				}

				numberInputRowDiv.appendChild(button);
			}
		}

		function CreateOperatorInputHandler(operator) {
			return function() {
				TryAddCurrentNumberToExpression();

				var expressionString = expressionRootNode.Serialize();

				if (operator === "=") {
					// you need a variable to use the assignment operator!
					var leftNode = GetLeftmostNode(expressionRootNode);
					if (leftNode.type === "symbol") {
						expressionString = leftNode.Serialize() + " " + operator;
					}
				}
				else {
					expressionString += " " + operator;
				}

				expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

				ResetExpressionDiv();
			}
		}

		function ResetExpressionDiv() {
				expressionDiv.innerHTML = "";
				var expressionEditor = new MathExpressionEditor(expressionRootNode, parentEditor, true);
				expressionDiv.appendChild(expressionEditor.GetElement());
				curNumberSpan = document.createElement("span");
				curNumberSpan.classList.add(GetColorClassForParameterType("number"));
				curNumberSpan.style.borderRadius = "2px";
				expressionDiv.appendChild(curNumberSpan);

				// reset the number stuff too
				curNumberBeforeDecimal = "";
				curNumberAfterDecimal = "";
				curNumberHasDecimal = false;
		}

		var operatorInputDiv = document.createElement("div");
		operatorInputDiv.style.flexGrow = "1";
		operatorInputDiv.style.display = "flex";
		operatorInputDiv.style.flexDirection = "column";
		numericInputRoot.appendChild(operatorInputDiv);

		var operatorInputs = ["=", "/", "*", "-", "+"];
		for (var i = 0; i < operatorInputs.length; i++) {
			var button = document.createElement("button");
			button.style.flexGrow = "1";
			button.innerText = operatorInputs[i];
			button.onclick = CreateOperatorInputHandler(operatorInputs[i]);

			if (operatorInputs[i] === "=") {
				button.classList.add("goldColor");
			}

			operatorInputDiv.appendChild(button);
		}

		var comparisonInputDiv = document.createElement("div");
		comparisonInputDiv.style.flexGrow = "1";
		comparisonInputDiv.style.display = "flex";
		comparisonInputDiv.style.flexDirection = "column";
		comparisonInputDiv.style.marginRight = "10px";
		numericInputRoot.appendChild(comparisonInputDiv);

		var comparisonInputs = ["==", ">=", "<=", ">", "<"];
		for (var i = 0; i < comparisonInputs.length; i++) {
			var button = document.createElement("button");
			button.style.flexGrow = "1";
			button.innerText = comparisonInputs[i];
			button.onclick = CreateOperatorInputHandler(comparisonInputs[i]);

			comparisonInputDiv.appendChild(button);	
		}

		// back button
		var backInputDiv = document.createElement("div");
		backInputDiv.style.flexGrow = "1";
		backInputDiv.style.display = "flex";
		backInputDiv.style.flexDirection = "column";
		numericInputRoot.appendChild(backInputDiv);

		var backButton = document.createElement("button");
		backButton.appendChild(iconUtils.CreateIcon("backspace"));
		backButton.onclick = function() {
			var expressionString = expressionRootNode.Serialize();
			var rightNode = GetRightmostNode(expressionRootNode);
			var substringToDelete = rightNode.type === "operator" ? " " + rightNode.operator + " " : rightNode.Serialize();
			expressionString = expressionString.slice(0, expressionString.length - substringToDelete.length);
			expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

			ResetExpressionDiv();
		}
		backInputDiv.appendChild(backButton);

		var clearButton = document.createElement("button");
		clearButton.innerText = localization.GetStringOrFallback("expression_builder_all_clear", "AC");
		clearButton.onclick = function() {
			expressionDiv.classList.add("expressionBuilderClearShake");
			setTimeout(function() {
				expressionDiv.classList.remove("expressionBuilderClearShake");
				var expressionString = "";
				expressionRootNode = scriptInterpreter.CreateExpression(expressionString);
				ResetExpressionDiv();
			}, 210);
		}
		backInputDiv.appendChild(clearButton);

		// NON NUMERIC INPUTS!

		var nonNumericInputDiv = document.createElement("div");
		// nonNumericInputDiv.style.flexGrow = "1";
		nonNumericInputDiv.style.marginBottom = "15px";
		nonNumericInputDiv.style.display = "flex";
		nonNumericInputDiv.style.flexDirection = "column";
		div.appendChild(nonNumericInputDiv);

		// add variable:
		var selectedVarNode = CreateDefaultArgNode("symbol");

		var addVariableDiv = document.createElement("div");
		addVariableDiv.style.display = "flex";
		addVariableDiv.classList.add("addNonNumericControlBox");
		addVariableDiv.classList.add("goldColorBackground");

		var variableParameterEditor = new ParameterEditor(
			["symbol"], 
			function() { return selectedVarNode; },
			function(node) { selectedVarNode = node; },
			true,
			false);

		var addVariableButton = document.createElement("button");
		addVariableButton.classList.add(GetColorClassForParameterType("symbol"));
		addVariableButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
			+ localization.GetStringOrFallback("variable_label", "symbol");;
		addVariableButton.style.flexGrow = "1";
		addVariableButton.style.marginRight = "5px";
		addVariableButton.onclick = function() {
			var expressionString = expressionRootNode.Serialize();
			expressionString += " " + selectedVarNode.Serialize();
			expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

			ResetExpressionDiv();
		}
		addVariableDiv.appendChild(addVariableButton);

		var variableParameterEl = variableParameterEditor.GetElement();
		variableParameterEl.style.flexGrow = "1";
		addVariableDiv.appendChild(variableParameterEl);

		nonNumericInputDiv.appendChild(addVariableDiv);

		// add item:
		var selectedItemNode = CreateDefaultArgNode("item");

		var addItemDiv = document.createElement("div");
		addItemDiv.style.display = "flex";
		addItemDiv.classList.add("addNonNumericControlBox");
		addItemDiv.classList.add("greenColorBackground");

		var itemParameterEditor = new ParameterEditor(
			["item"], 
			function() { return selectedItemNode; },
			function(node) { selectedItemNode = node; },
			true,
			false);

		var addItemButton = document.createElement("button");
		addItemButton.classList.add(GetColorClassForParameterType("item"));
		addItemButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
			+ localization.GetStringOrFallback("item_label", "item");
		addItemButton.style.flexGrow = "1";
		addItemButton.style.marginRight = "5px";
		addItemButton.onclick = function() {
			var expressionString = expressionRootNode.Serialize();
			expressionString += " " + "{item " + selectedItemNode.Serialize() + "}";
			expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

			ResetExpressionDiv();
		}
		addItemDiv.appendChild(addItemButton);

		var itemParameterEl = itemParameterEditor.GetElement();
		itemParameterEl.style.flexGrow = "1";
		addItemDiv.appendChild(itemParameterEl);

		nonNumericInputDiv.appendChild(addItemDiv);

		// add text:
		var selectedTextNode = CreateDefaultArgNode("string");

		var addTextDiv = document.createElement("div");
		addTextDiv.style.display = "flex";
		addTextDiv.classList.add("addNonNumericControlBox");
		addTextDiv.classList.add("greenColorBackground");

		var textParameterEditor = new ParameterEditor(
			["string"], 
			function() { return selectedTextNode; },
			function(node) { selectedTextNode = node; },
			true,
			false);

		var addTextButton = document.createElement("button");
		addTextButton.classList.add(GetColorClassForParameterType("string"));
		addTextButton.innerHTML = iconUtils.CreateIcon("add").outerHTML + " "
			+ localization.GetStringOrFallback("value_type_text", "string");
		addTextButton.style.flexGrow = "1";
		addTextButton.style.marginRight = "5px";
		addTextButton.onclick = function() {
			var expressionString = expressionRootNode.Serialize();
			expressionString += " " + selectedTextNode.Serialize();
			expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

			ResetExpressionDiv();
		}
		addTextDiv.appendChild(addTextButton);

		var textParameterEl = textParameterEditor.GetElement();
		textParameterEl.style.flexGrow = "1";
		addTextDiv.appendChild(textParameterEl);

		nonNumericInputDiv.appendChild(addTextDiv);

		// bool buttons
		function CreateBoolInputHandler(bool) {
			return function() {
				var expressionString = expressionRootNode.Serialize();
				expressionString += " " + bool;
				expressionRootNode = scriptInterpreter.CreateExpression(expressionString);

				ResetExpressionDiv();
			}
		}

		var boolInputDiv = document.createElement("div");
		boolInputDiv.style.display = "flex";
		nonNumericInputDiv.appendChild(boolInputDiv);

		var boolInputs = ["YES", "NO"];
		for (var i = 0; i < boolInputs.length; i++) {
			var button = document.createElement("button");
			button.classList.add(GetColorClassForParameterType("boolean"));
			button.style.flexGrow = "1";
			button.innerText = boolInputs[i];
			button.onclick = CreateBoolInputHandler(boolInputs[i]);

			boolInputDiv.appendChild(button);
		}

		// controls for finishing building the expression
		var finishControlsRoot = document.createElement("div");
		finishControlsRoot.style.display = "flex";
		div.appendChild(finishControlsRoot);

		var leftSideSpaceSpan = document.createElement("span");
		leftSideSpaceSpan.style.flexGrow = "3";
		finishControlsRoot.appendChild(leftSideSpaceSpan);

		var cancelButton = document.createElement("button");
		cancelButton.style.flexGrow = "1";
		cancelButton.innerHTML = iconUtils.CreateIcon("cancel").outerHTML + " "
			+ localization.GetStringOrFallback("action_cancel", "cancel");
		cancelButton.onclick = function() {
			div.classList.add("expressionBuilderCancel");
			setTimeout(onCancelHandler, 250);
		};
		finishControlsRoot.appendChild(cancelButton);

		var acceptButton = document.createElement("button");
		acceptButton.style.flexGrow = "2";
		acceptButton.innerHTML = iconUtils.CreateIcon("checkmark").outerHTML + " "
			+ localization.GetStringOrFallback("action_save", "save");
		acceptButton.classList.add("reverseColors");
		acceptButton.onclick = function() {
			acceptButton.classList.add("expressionBuilderSaveFlash");
			div.classList.add("expressionBuilderSave");
			setTimeout(function() {
				TryAddCurrentNumberToExpression();
				onAcceptHandler(expressionRootNode);
			}, 750);
		}
		finishControlsRoot.appendChild(acceptButton);

		this.GetElement = function() {
			return div;
		}

		function GetRightmostNode(node) {
			if (node.type === "operator") {
				if (node.right === undefined || node.right === null ||
					(node.right.type === "literal" && node.right.value === null)) {
					return node;
				}
				else {
					return GetRightmostNode(node.right);
				}
			}
			else {
				return node;
			}
		}

		function GetLeftmostNode(node) {
			if (node.type === "operator") {
				if (node.left === undefined || node.left === null ||
					(node.left.type === "literal" && node.left.value === null)) {
					return node;
				}
				else {
					return GetLeftmostNode(node.left);
				}
			}
			else {
				return node;
			}
		}
	}
}

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

var dialogSel = {
	target : null,
	start : 0,
	end : 0,
	onchange : null
}

function createOnTextSelectionChange(onchange) {
	return function(event) {
		dialogSel.target = event.target;
		dialogSel.start = event.target.selectionStart;
		dialogSel.end = event.target.selectionEnd;
		dialogSel.onchange = onchange;

		var effectButtons = document.getElementsByClassName("dialogEffectButton");
		for(var i = 0; i < effectButtons.length; i++) {
			effectButtons[i].disabled = false;
		}
	}
}

function preventTextDeselect(event) {
	if(dialogSel.target != null) {
		// event.preventDefault();
	}
}

function preventTextDeselectAndClick(event) {
	if(dialogSel.target != null) {
		// event.preventDefault();
		event.target.click();
	}
}

function wrapTextSelection(effect) {
	if( dialogSel.target != null ) {
		var curText = dialogSel.target.value;
		var selText = curText.slice(dialogSel.start, dialogSel.end);

		var isEffectAlreadyApplied = selText.indexOf( effect ) > -1;
		if(isEffectAlreadyApplied) {
			//remove all instances of effect
			var effectlessText = selText.split( effect ).join( "" );
			var newText = curText.slice(0, dialogSel.start) + effectlessText + curText.slice(dialogSel.end);
			dialogSel.target.value = newText;
			dialogSel.target.setSelectionRange(dialogSel.start,dialogSel.start + effectlessText.length);
			if(dialogSel.onchange != null)
				dialogSel.onchange( dialogSel ); // dialogSel needs to mimic the event the onchange would usually receive
		}
		else {
			// add effect
			var effectText = effect + selText + effect;
			var newText = curText.slice(0, dialogSel.start) + effectText + curText.slice(dialogSel.end);
			dialogSel.target.value = newText;
			dialogSel.target.setSelectionRange(dialogSel.start,dialogSel.start + effectText.length);
			if(dialogSel.onchange != null)
				dialogSel.onchange( dialogSel ); // dialogSel needs to mimic the event the onchange would usually receive
		}
	}
}