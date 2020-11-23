function DialogTool(controls) {
	var curDialogId = null;
	var curScriptEditor = null;

	var textEffects = new TextEffectsControl();
	textEffects.Update(false);

	// todo : rename since it doesn't always "open" it?
	function openDialogTool(dialogId, insertNextToId, showIfHidden) {
		if (showIfHidden === undefined || showIfHidden === null) {
			showIfHidden = true;
		}

		controls.nav.del.disabled = dialogId === titleDialogId;

		var showCode = controls.showCodeToggle.checked;

		var size = null;

		// clean up any existing editors -- is there a more "automagical" way to do this???
		if (curScriptEditor) {
			size = curScriptEditor.GetSize();
			curScriptEditor.OnDestroy();
			delete curScriptEditor;
		}

		curDialogId = dialogId;
		curScriptEditor = new ScriptEditor(dialogId);
		curScriptEditor.SetPlaintextMode(showCode);

		if (size != null) {
			curScriptEditor.SetSize(size.width, size.height);
		}

		var dialogEditorViewport = controls.scriptEditorViewport;
		dialogEditorViewport.innerHTML = "";

		dialogEditorViewport.appendChild(curScriptEditor.GetElement());

		// todo : localize!
		controls.nameInput.placeholder = "dialog " + dialogId +
			" (" + fromB256(dialogId) + "/" + (DEFAULT_REGISTRY_SIZE - 1) + ")";

		if (dialogId === titleDialogId) {
			controls.nameInput.readOnly = true;
			// todo : localize
			controls.nameInput.value = "title";
		}
		else {
			controls.nameInput.readOnly = false;
			if (dialog[dialogId].name != null) {
				controls.nameInput.value = dialog[dialogId].name;
			}
			else {
				controls.nameInput.value = "";
			}
		}

		var isHiddenOrShouldMove = (controls.panelRoot.style.display === "none") ||
			(insertNextToId != undefined && insertNextToId != null);

		if (isHiddenOrShouldMove && showIfHidden) {
			showPanel("dialogPanel", insertNextToId);
		}
	}

	function onDialogNameChange(event) {
		if (event.target.value != null && event.target.value.length > 0) {
			dialog[curDialogId].name = event.target.value;
		}
		else {
			dialog[curDialogId].name = null;
		}

		refreshGameData();

		events.Raise("change_dialog_name", { id: curDialogId, name: dialog[curDialogId].name });
	}

	function nextDialog() {
		var id = titleDialogId; // the title is safe as a default choice

		if (curDialogId != null) {
			var dialogIdList = sortedIdList(dialog);
			var dialogIndex = dialogIdList.indexOf(curDialogId);

			// pick the index of the next dialog to open
			dialogIndex++;
			if (dialogIndex >= dialogIdList.length) {
				dialogIndex = 0;
			}

			// turn the index into an ID
			id = dialogIdList[dialogIndex];
		}

		events.Raise("select_dialog", { id: id });
	}

	function prevDialog() {
		var id = titleDialogId; // the title is safe as a default choice

		if (curDialogId != null) {
			var dialogIdList = sortedIdList(dialog);
			var dialogIndex = dialogIdList.indexOf(curDialogId);

			// pick the index of the next dialog to open
			dialogIndex--;
			if (dialogIndex < 0) {
				dialogIndex = dialogIdList.length - 1;
			}

			// turn the index into an ID
			id = dialogIdList[dialogIndex];
		}

		events.Raise("select_dialog", { id: id });
	}

	// todo : move into its own tool?
	function addNewDialog() {
		var id = nextB256Id(dialog, 1, DEFAULT_REGISTRY_SIZE);

		if (id != null) {
			// todo : need shared create method
			dialog[id] = createScript(id, null, "...");
			refreshGameData();

			events.Raise("select_dialog", { id: id });

			events.Raise("new_dialog", { id:id });
		}
		else {
			alert("oh no you ran out of dialog! :(");
		}
	}

	function duplicateDialog() {
		if (curDialogId != null) {
			var id = nextB256Id(dialog, 1, DEFAULT_REGISTRY_SIZE);

			if (id != null) {
				dialog[id] = createScript(id, null, dialog[curDialogId].src.slice());
				refreshGameData();

				events.Raise("select_dialog", { id: id });
			}
			else {
				alert("oh no you ran out of dialog! :(");
			}
		}
	}

	function deleteDialog() {
		var shouldDelete = confirm("Are you sure you want to delete this dialog?");

		if (shouldDelete && curDialogId != null && curDialogId != titleDialogId) {
			var tempDialogId = curDialogId;

			nextDialog();

			// delete all references to deleted dialog (TODO : should this go in a wrapper function somewhere?)
			for (id in tile) {
				if (tile[id].dlg === tempDialogId) {
					tile[id].dlg = null;
				}
			}

			delete dialog[tempDialogId];
			refreshGameData();

			events.Raise("dialog_delete", { dialogId:tempDialogId, editorId:null });
		}
	}

	function toggleDialogCode(e) {
		var showCode = e.target.checked;
		curScriptEditor.SetPlaintextMode(showCode);

		if (showCode) {
			controls.editControls.container.disabled = true;
			controls.editControls.container.classList.add("disabledControls");
		}
		else {
			controls.editControls.container.disabled = false;
			controls.editControls.container.classList.remove("disabledControls");
		}
	}

	var alwaysShowDrawingDialog = true;
	function toggleAlwaysShowDrawingDialog(e) {
		// TODO : re-implement?

		// alwaysShowDrawingDialog = e.target.checked;

		// if (alwaysShowDrawingDialog) {
		// 	var dlg = getCurDialogId();
		// 	if (dialog[dlg]) {
		// 		events.Raise("select_dialog", { id: dlg });
		// 	}
		// }
	}

	/* controls */
	controls.nameInput.onchange = onDialogNameChange;
	controls.previewToggle.onclick = togglePreviewDialog;
	controls.showCodeToggle.onclick = toggleDialogCode;
	controls.nav.prev.onclick = prevDialog;
	controls.nav.next.onclick = nextDialog;
	controls.nav.add.onclick = addNewDialog;
	controls.nav.copy.onclick = duplicateDialog;
	controls.nav.del.onclick = deleteDialog;

	controls.editControls.editDialogAdd.onclick = function() {
		controls.editControls.dialogAddControls.style.display = "flex";
		textEffects.Update(false);
	};
	controls.editControls.editDialogAdd.checked = true;

	controls.editControls.editDialogTextEffects.onclick = function() {
		controls.editControls.dialogAddControls.style.display = "none";
		textEffects.Update(true);
	};

	controls.editControls.textEffectsControls.appendChild(textEffects.GetElement());

	controls.editControls.addDialogControls.dialog.onclick = function() {
		curScriptEditor.AddDialog();
	};

	controls.editControls.addDialogControls.choice.onclick = function() {
		curScriptEditor.AddChoice();
	};

	controls.editControls.addDialogControls.sequence.onclick = function() {
		curScriptEditor.AddSequence();
	};

	controls.editControls.addDialogControls.cycle.onclick = function() {
		curScriptEditor.AddCycle();
	};

	controls.editControls.addDialogControls.shuffle.onclick = function() {
		curScriptEditor.AddShuffle();
	};

	controls.editControls.addDialogControls.conditional.onclick = function() {
		curScriptEditor.AddConditional();
	};

	/* events */
	events.Listen("select_dialog", function(e) {
		openDialogTool(e.id, e.insertNextToId, e.showIfHidden);
	});
}

function TextEffectsControl() {
	var textEffectsControlsDiv = document.createElement("div");

	var textEffects = [
		{
			name: localization.GetStringOrFallback("dialog_effect_color1", "color 1"),
			description: "text in tags matches the 1st color in the palette", // todo : localize these!
			iconId: "colors",
			tagOpen : "{CLR 0}",
			tagClose : "{/CLR}",
			getStyle : function() { return paletteTool ? paletteTool.GetStyle(0) : null; },
			getBackground : function() { return paletteTool ? paletteTool.GetBackgroundColor(0) : null; },
		},
		{
			name: localization.GetStringOrFallback("dialog_effect_color2", "color 2"),
			description: "text in tags matches the 2nd color in the palette",
			iconId: "colors",
			tagOpen : "{CLR 1}",
			tagClose : "{/CLR}",
			getStyle : function() { return paletteTool ? paletteTool.GetStyle(1) : null; },
			getBackground : function() { return paletteTool ? paletteTool.GetBackgroundColor(1) : null; },
		},
		{
			name: localization.GetStringOrFallback("dialog_effect_color3", "color 3"),
			description: "text in tags matches the 3rd color in the palette",
			iconId: "colors",
			tagOpen : "{CLR 2}",
			tagClose : "{/CLR}",
			getStyle : function() { return paletteTool ? paletteTool.GetStyle(2) : null; },
			getBackground : function() { return paletteTool ? paletteTool.GetBackgroundColor(2) : null; },
		},
		{
			name: "WVY", //localization.GetStringOrFallback("dialog_effect_wavy", "wavy"),
			description: "text in tags waves up and down",
			iconId: null,
			tagOpen : "{WVY}",
			tagClose : "{/WVY}",
			styleName: "textEffectWvyButton",
			getStyle : function() { return "textEffectWvyButton"; },
		},
		{
			name: "SHK", //localization.GetStringOrFallback("dialog_effect_shaky", "shaky"),
			description: "text in tags shakes constantly",
			iconId: null,
			tagOpen : "{SHK}",
			tagClose : "{/SHK}",
			getStyle : function() { return "textEffectShkButton"; },
		},
		{
			name: "RBW", //localization.GetStringOrFallback("dialog_effect_rainbow", "rainbow"),
			description: "text in tags is rainbow colored",
			iconId: null,
			tagOpen : "{RBW}",
			tagClose : "{/RBW}",
			getStyle : function() { return "textEffectRbwButton"; },
		},
		{
			name: "BR",
			description: "add linebreak",
			iconId: null,
			tagOpen: "",
			tagClose: "{BR}",
			getStyle : function() { return "textEffectBrButton"; },
		},
		{
			name: "PG",
			description: "add pagebreak",
			iconId: null,
			tagOpen: "",
			tagClose: "{PG}",
			getStyle : function() { return "textEffectPgButton"; },
		},
	];

	function CreateAddEffectHandler(tagOpen, tagClose) {
		return function() {
			wrapTextSelection(tagOpen, tagClose); // hacky to still use this?
		}
	}

	var effectButtons = [];

	for (var i = 0; i < textEffects.length; i++) {
		var effect = textEffects[i];

		var effectButton = document.createElement("button");
		effectButton.onclick = CreateAddEffectHandler(effect.tagOpen, effect.tagClose);

		if (effect.iconId != null && iconUtils != null) {
			effectButton.appendChild(iconUtils.CreateIcon(effect.iconId));
		}
		else {
			effectButton.innerText = effect.name;
		}

		effectButton.title = effect.description;

		if (effect.getBackground) {
			effectButton.style.background = effect.getBackground();
		}

		if (effect.getStyle) {
			effectButton.setAttribute("class", effect.getStyle());
		}

		effectButtons.push(effectButton);

		textEffectsControlsDiv.appendChild(effectButton);
	}

	var textEffectsPrintDrawingSpan = document.createElement("span");
	textEffectsPrintDrawingSpan.classList.add("textEffectDrwSelect");
	textEffectsControlsDiv.appendChild(textEffectsPrintDrawingSpan);

	function TryUpdateTextEffectDrwSelectControls() {
		if (findTool) {
			textEffectsPrintDrawingSpan.innerHTML = "";

			var textEffectsPrintDrawingButton = document.createElement("button");
			textEffectsPrintDrawingButton.appendChild(iconUtils.CreateIcon("paint"));
			textEffectsPrintDrawingButton.title = "draw a tile in your dialog";
			textEffectsPrintDrawingSpan.appendChild(textEffectsPrintDrawingButton);

			var seperatorSpan = document.createElement("span");
			seperatorSpan.innerText = ":";
			seperatorSpan.style.marginLeft = "2px"; // hacky styles..
			seperatorSpan.style.marginRight = "4px";
			textEffectsPrintDrawingSpan.appendChild(seperatorSpan);

			var textEffectDrwId = sortedIdList(tile)[0];

			var textEffectDrwSelect = findTool.CreateSelectControl(
				"drawing",
				{
					onSelectChange : function(id) {
						textEffectDrwId = id;
					},
					filters : ["avatar", "sprite", "tile", "item", "exit", "ending"],
					toolId : "dialogPanel",
					getSelectMessage : function() {
						// todo : localize
						return "select drawing";
					},
					// showDropdown : false, // todo : show or not?
					showOpenTool : false,
				});

			textEffectDrwSelect.SetSelection(textEffectDrwId);

			textEffectsPrintDrawingSpan.appendChild(textEffectDrwSelect.GetElement());

			textEffectsPrintDrawingButton.onclick = function() {
				wrapTextSelection("", '{DRW "' + textEffectDrwId + '"}');
			};
		}
	}

	function UpdateTextEffectsControls(visible) {
		textEffectsControlsDiv.style.display = visible ? "flex" : "none";

		UpdateButtonStyles();

		if (visible) {
			TryUpdateTextEffectDrwSelectControls();
		}
	}

	function UpdateButtonStyles() {
		for (var i = 0; i < textEffects.length; i++) {
			var effect = textEffects[i];
			var effectButton = effectButtons[i];

			if (effect.getBackground) {
				effectButton.style.background = effect.getBackground();
			}

			if (effect.getStyle) {
				effectButton.setAttribute("class", effect.getStyle());
			}
		}
	}

	this.Update = UpdateTextEffectsControls;

	this.GetElement = function() {
		return textEffectsControlsDiv;
	};

	events.Listen("palette_change", function(event) {
		UpdateButtonStyles();
	});
}

function DialogControl(parentPanelId) {
	// todo : localize
	var dialogEventTypes = {};

	dialogEventTypes[ARG_KEY.DIALOG_SCRIPT] = {
		name : "dialog",
		shortName : "dialog",
		propertyId : "dlg",
		defaultScript : 'hi there!', // todo : changed based on sprite type?
		selectControl : null,
	};

	dialogEventTypes[ARG_KEY.FRAME_TICK_SCRIPT] = {
		name : "on frame tick",
		shortName : "tick",
		propertyId : "tickDlgId",
		defaultScript :
			'{>>\n' +
			'    {FN {FRM}\n' +
			'        {HOP "RGT"}\n' +
			'    }\n' +
			'}',
		selectControl : null,
		selectRoot : null,
	};

	dialogEventTypes[ARG_KEY.KNOCK_INTO_SCRIPT] = {
		name : "on knock into",
		shortName : "knock",
		propertyId : "knockDlgId",
		defaultScript : // todo : is this the script I want?
			'{>>\n' +
			'    {FN {THAT}\n' +
			'        {RID THAT}\n' +
			'    }\n' +
			'}',
		selectControl : null,
		selectRoot : null,
	};

	dialogEventTypes[ARG_KEY.BUTTON_DOWN_SCRIPT] = {
		name : "on button",
		shortName : "button",
		propertyId : "buttonDownDlgId",
		defaultScript : // todo : is this the script I want?
			'{>>\n' +
			'    {FN {BTN HLD}\n' +
			'        {>> player pressed {SAY BTN}}\n' +
			'    }\n' +
			'}',
		selectControl : null,
		selectRoot : null,
	};

	var drawingId = null;
	var curEventId = ARG_KEY.DIALOG_SCRIPT;

	this.SetDrawing = function(id) {
		drawingId = id;
		UpdateDialogIdSelectOptions();
		
		setSelectedEvent(ARG_KEY.DIALOG_SCRIPT);

		if (tile[drawingId].type === TYPE_KEY.AVATAR) {
			ChangeSettingsVisibility(true);
		}
		else {
			ChangeSettingsVisibility(false);
		}
	}

	function selectedDialogId() {
		var id = null;

		if (tile[drawingId]) {
			id = tile[drawingId][dialogEventTypes[curEventId].propertyId];
		}

		return id;
	}

	var showSettings = false;

	var div = document.createElement("div");
	div.classList.add("controlBox");

	var controlDiv = document.createElement("div");
	controlDiv.classList.add("dialogControlTop");
	div.appendChild(controlDiv);

	var labelSpan = document.createElement("span");
	labelSpan.classList.add("dialogControlLabel");
	controlDiv.appendChild(labelSpan);

	var dialogIcon = iconUtils.CreateIcon("dialog");
	dialogIcon.classList.add("icon_space_right");
	labelSpan.appendChild(dialogIcon);

	var labelTextSpan = document.createElement("span");
	labelSpan.appendChild(labelTextSpan);

	var settingsButton = document.createElement("button");
	settingsButton.appendChild(iconUtils.CreateIcon("settings"));
	controlDiv.appendChild(settingsButton);

	var openButton = document.createElement("button");
	openButton.title = "open in dialog editor"; // todo : localize
	openButton.appendChild(iconUtils.CreateIcon("open_tool"));
	openButton.onclick = function() {
		events.Raise(
			"select_dialog",
			{
				id: selectedDialogId(),
				insertNextToId: parentPanelId,
			});

		showPanel("dialogPanel", parentPanelId);
	};
	controlDiv.appendChild(openButton);

	var editorDiv = document.createElement("div");
	editorDiv.style.display = "flex";
	editorDiv.style.marginTop = "5px";
	editorDiv.classList.add("dialogBoxContainer");
	div.appendChild(editorDiv);

	function createNewDialog(dialogEvent, src, openTool) {
		var nextDlgId = nextB256Id(dialog, 1, DEFAULT_REGISTRY_SIZE);

		if (nextDlgId != null) {
			var nextName = "";

			if (findTool) {
				nextName += findTool.GetDisplayName("drawing", drawingId);
				nextName += " ";
			}

			nextName += dialogEvent.shortName;

			nextName = CreateDefaultName(nextName, dialog, true);

			dialog[nextDlgId] = createScript(nextDlgId, nextName, src);

			curDlgId = nextDlgId;

			dialogEvent.selectControl.UpdateOptions();
			dialogEvent.selectControl.SetSelection(curDlgId);

			if (openTool) {
				dialogEvent.selectControl.OpenTool();
			}

			refreshGameData();

			events.Raise("new_dialog", { id: nextDlgId, });
		}
		else {
			alert("oh no you ran out of dialog! :(");
		}
	}

	var textArea = document.createElement("textarea");
	textArea.rows = 2;

	textArea.oninput = function(e) {
		// todo : delete empty dialogs?
		var curDlgId = selectedDialogId();

		if (curDlgId != null) {
			// todo : ADD wrapping dialog block for multiline scripts
			var scriptRoot = scriptNext.Parse(e.target.value, DialogWrapMode.Yes);
			var scriptStr = scriptNext.Serialize(scriptRoot);

			// handle one line scripts: a little hard coded
			if (scriptStr.indexOf("\n") === -1) {
				var startOffset = SYM_KEY.OPEN.length + SYM_KEY.DIALOG.length + 1;
				var endOffset = startOffset + SYM_KEY.CLOSE.length;
				scriptStr = scriptStr.substr(startOffset, scriptStr.length - endOffset);
			}

			dialog[curDlgId].src = scriptStr;

			refreshGameData();
		}
		else if (curEventId === ARG_KEY.DIALOG_SCRIPT && tile[drawingId].type != TYPE_KEY.AVATAR) {
			createNewDialog(dialogEventTypes[curEventId], e.target.value, false);
			openButton.disabled = false;
		}
	}

	textArea.onblur = function() {
		var curDlgId = selectedDialogId();

		if (curDlgId != null) {
			events.Raise("dialog_update", { dialogId: curDlgId, editorId: "_dialog_control_" });
		}
	};

	editorDiv.appendChild(textArea);

	var dialogIdSelectRoot = document.createElement("div");
	dialogIdSelectRoot.style.display = "none";
	div.appendChild(dialogIdSelectRoot);

	function setSelectedEvent(id) {
		curEventId = id;
		labelTextSpan.innerText = dialogEventTypes[curEventId].name;

		// todo : strip off the outer dialog block stuff
		var curDlgId = selectedDialogId();

		if (curDlgId != null) {
			var scriptRoot = scriptNext.Parse(dialog[curDlgId].src);
			textArea.value = scriptNext.SerializeUnwrapped(scriptRoot);
		}
		else {
			textArea.value = "";
		}
	}

	function UpdateDialogIdSelectOptions() {
		function createDialogSelectControl(eventId) {
			var dialogEvent = dialogEventTypes[eventId];

			var selectEvent = document.createElement("div");
			selectEvent.classList.add("dialogEvent");
			dialogIdSelectRoot.appendChild(selectEvent);

			var selectEventEditButton = document.createElement("button");
			selectEvent.appendChild(selectEventEditButton);

			function updateEventEditButton() {
				var curDlgId = tile[drawingId][dialogEvent.propertyId];
				var curIcon = curDlgId === null ? "add" : "edit";
				selectEventEditButton.innerHTML = "";
				selectEventEditButton.appendChild(iconUtils.CreateIcon(curIcon));
			}

			selectEventEditButton.onclick = function() {
				var curDlgId = tile[drawingId][dialogEvent.propertyId];
				if (curDlgId === null) {
					createNewDialog(dialogEvent, dialogEvent.defaultScript, true);
					curEventId = eventId;
				}
				else {
					setSelectedEvent(eventId);
					ChangeSettingsVisibility(false);
				}

				updateEventEditButton();
			}

			var selectEventName = document.createElement("span");
			selectEventName.innerText = dialogEvent.name + ":";
			selectEvent.appendChild(selectEventName);

			var spacer = document.createElement("span");
			spacer.classList.add("expandingSpacer");
			selectEvent.appendChild(spacer);

			dialogEvent.selectControl = findTool.CreateSelectControl(
				"dialog",
				{
					onSelectChange : function(id) {
						tile[drawingId][dialogEvent.propertyId] = id;
						updateEventEditButton();
						UpdateSettingsButtingDisabled(true);
						refreshGameData();
					},
					toolId : parentPanelId,
					filters : ["dialog", "no_title"],
					getSelectMessage : function() {
						// todo : make less awkward sounding!
						return "select dialog for " + dialogEvent.name + "...";
					},
					hasNoneOption : true,
				});

			selectEvent.appendChild(dialogEvent.selectControl.GetElement());

			dialogEvent.selectRoot = selectEvent;
		}

		if (findTool) {
			for (var id in dialogEventTypes) {
				var dialogEvent = dialogEventTypes[id];
				if (dialogEvent.selectControl === null) {
					createDialogSelectControl(id);
				}
			}
		}

		if (tile[drawingId]) { // todo : why would this fail?
			for (var id in dialogEventTypes) {
				var dialogEvent = dialogEventTypes[id];
				if (dialogEvent.selectControl) {
					if (id === ARG_KEY.DIALOG_SCRIPT && tile[drawingId].type === TYPE_KEY.AVATAR) {
						dialogEvent.selectRoot.style.display = "none";
					}
					else {
						var curDlgId = tile[drawingId][dialogEvent.propertyId];
						dialogEvent.selectControl.UpdateOptions();
						dialogEvent.selectControl.SetSelection(curDlgId);
						dialogEvent.selectRoot.style.display = "flex";
					}
				}
			}
		}
	}

	UpdateDialogIdSelectOptions();

	events.Listen("new_dialog", function() { UpdateDialogIdSelectOptions(); });

	events.Listen("dialog_update", function(event) {
		if (event.dialogId === selectedDialogId() && event.editorId != "_dialog_control_") {
			setSelectedEvent(curEventId); // hack to refresh text..
		}
	});

	function ChangeSettingsVisibility(visible) {
		showSettings = visible;
		editorDiv.style.display = showSettings ? "none" : "flex";
		dialogIdSelectRoot.style.display = showSettings ? "block" : "none";
		openButton.style.display = showSettings ? "none" : "inline";

		openButton.disabled = false;
		var eventPropertyId = dialogEventTypes[curEventId].propertyId;
		var doesEventExist = (eventPropertyId in tile[drawingId]) && (tile[drawingId][eventPropertyId] != null);
		if (!showSettings && !doesEventExist) {
			openButton.disabled = true;
		}

		settingsButton.innerHTML = "";
		settingsButton.appendChild(iconUtils.CreateIcon(visible ? "text_edit" : "settings"));

		UpdateSettingsButtingDisabled(visible);
	}

	// todo : UI question.. do I really want the settings button on in settings mode??
	function UpdateSettingsButtingDisabled(visible) {
		settingsButton.disabled = false;

		var eventPropertyId = dialogEventTypes[curEventId].propertyId;

		if (visible) {
			var doesEventExist = (eventPropertyId in tile[drawingId]) && (tile[drawingId][eventPropertyId] != null);
			var allowsTextboxToCreate = (curEventId === ARG_KEY.DIALOG_SCRIPT) && (tile[drawingId].type != TYPE_KEY.AVATAR);

			settingsButton.disabled = !doesEventExist && !allowsTextboxToCreate;
		}
	}

	settingsButton.onclick = function() {
		ChangeSettingsVisibility(!showSettings);

		if (showSettings) {
			labelTextSpan.innerText = "dialog events"; // todo : localize // todo : best name?
		}
		else {
			setSelectedEvent(curEventId);
		}
	}

	this.GetElement = function() {
		return div;
	}

	setSelectedEvent(ARG_KEY.DIALOG_SCRIPT);
}

// todo : keep as global for now?
var isPreviewDialogMode = false;
function togglePreviewDialog(event) {
	if (event.target.checked) {
		if (curDialogEditor != null) {
			isPreviewDialogMode = true;

			if (document.getElementById("roomPanel").style.display === "none") {
				showPanel("roomPanel");
			}

			on_play_mode();
		
			startPreviewDialog(
				curDialogEditor.GetScriptRoot(), 
				function() {
					togglePreviewDialog({ target : { checked : false } });
				});
		}
	}
	else {
		on_edit_mode();
		isPreviewDialogMode = false;
	}

	updatePlayModeButton();
	updatePreviewDialogButton();
}