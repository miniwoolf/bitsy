function ScriptTool(controls) {
	var curScriptId = null;
	var curScriptEditor = null;

	var textEffects = new TextEffectsControl();
	textEffects.Update(false);

	var scriptCues = new ScriptCues();

	function OnSelect(id, insertNextToId, showIfHidden) {
		if (showIfHidden === undefined || showIfHidden === null) {
			showIfHidden = true;
		}

		curScriptId = id;
		var isTitle = (curScriptId === titleId);

		controls.nav.del.disabled = isTitle;

		var showCode = controls.showCodeToggle.checked;

		var size = null;

		// clean up any existing editors -- is there a more "automagical" way to do this???
		if (curScriptEditor) {
			size = curScriptEditor.GetSize();
			curScriptEditor.OnDestroy();
			delete curScriptEditor;
		}

		curScriptEditor = new ScriptEditor(curScriptId);
		curScriptEditor.SetPlaintextMode(showCode);

		if (size != null) {
			curScriptEditor.SetSize(size.width, size.height);
		}

		controls.scriptEditorViewport.innerHTML = "";
		controls.scriptEditorViewport.appendChild(curScriptEditor.GetElement());

		// todo : localize!
		controls.nameInput.placeholder = "dialog " + curScriptId +
			" " + makeCountLabel(curScriptId, dialog, DEFAULT_REGISTRY_SIZE);

		if (isTitle) {
			controls.nameInput.readOnly = true;
			// todo : localize
			controls.nameInput.value = "title";
		}
		else {
			controls.nameInput.readOnly = false;
			if (dialog[curScriptId].name != null) {
				controls.nameInput.value = dialog[curScriptId].name;
			}
			else {
				controls.nameInput.value = "";
			}
		}

		var isHiddenOrShouldMove = (controls.panelRoot.style.display === "none") ||
			(insertNextToId != undefined && insertNextToId != null);

		if (isHiddenOrShouldMove && showIfHidden) {
			showPanel("scriptPanel", insertNextToId);
		}
	}

	function onNameChange(event) {
		if (event.target.value != null && event.target.value.length > 0) {
			dialog[curScriptId].name = event.target.value;
		}
		else {
			dialog[curScriptId].name = null;
		}

		refreshGameData();

		events.Raise("change_dialog_name", { id: curScriptId, name: dialog[curScriptId].name, });
	}

	function nextScript() {
		var id = titleId; // the title is safe as a default choice

		if (curScriptId != null) {
			var scriptIdList = sortedIdList(dialog);
			var scriptIndex = scriptIdList.indexOf(curScriptId);

			// pick the index of the next dialog to open
			scriptIndex++;
			if (scriptIndex >= scriptIdList.length) {
				scriptIndex = 0;
			}

			// turn the index into an ID
			id = scriptIdList[scriptIndex];
		}

		events.Raise("select_dialog", { id: id });
	}

	function prevScript() {
		var id = titleId; // the title is safe as a default choice

		if (curScriptId != null) {
			var scriptIdList = sortedIdList(dialog);
			var scriptIndex = scriptIdList.indexOf(curScriptId);

			// pick the index of the next dialog to open
			scriptIndex--;
			if (scriptIndex < 0) {
				scriptIndex = scriptIdList.length - 1;
			}

			// turn the index into an ID
			id = scriptIdList[scriptIndex];
		}

		events.Raise("select_dialog", { id: id });
	}

	function addNewScript() {
		var id = nextB256Id(dialog, 1, DEFAULT_REGISTRY_SIZE);

		if (id != null) {
			// todo : need shared create method
			dialog[id] = createScript(id, null, "...");
			refreshGameData();

			events.Raise("select_dialog", { id: id });
			events.Raise("new_dialog", { id: id });
		}
		else {
			alert("oh no you ran out of scripts! :(");
		}
	}

	function duplicateScript() {
		if (curScriptId != null) {
			var id = nextB256Id(dialog, 1, DEFAULT_REGISTRY_SIZE);

			if (id != null) {
				dialog[id] = createScript(id, null, dialog[curScriptId].src.slice());
				refreshGameData();

				events.Raise("select_dialog", { id: id });
				events.Raise("new_dialog", { id: id });
			}
			else {
				alert("oh no you ran out of scripts! :(");
			}
		}
	}

	function deleteScript() {
		var shouldDelete = confirm("Are you sure you want to delete this script?");

		if (shouldDelete && curScriptId != null && curScriptId != titleId) {
			var tempScriptId = curScriptId;

			nextScript();

			for (id in tile) {
				scriptCues.ClearAllContainingScript(tempScriptId, id);
			}

			delete dialog[tempScriptId];
			refreshGameData();

			events.Raise("dialog_delete", { dialogId:tempScriptId, editorId:null });
		}
	}

	function togglePlaintextCode(e) {
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
	controls.nameInput.onchange = onNameChange;
	controls.previewToggle.onclick = togglePreviewDialog;
	controls.showCodeToggle.onclick = togglePlaintextCode;
	controls.nav.prev.onclick = prevScript;
	controls.nav.next.onclick = nextScript;
	controls.nav.add.onclick = addNewScript;
	controls.nav.copy.onclick = duplicateScript;
	controls.nav.del.onclick = deleteScript;

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
		OnSelect(e.id, e.insertNextToId, e.showIfHidden);
	});

	// init to title
	OnSelect(titleId, null, false);
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
					toolId : "scriptPanel",
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

function ScriptCues() {
	// todo : localize
	var scriptCueTypes = {};

	scriptCueTypes[ARG_KEY.DIALOG_SCRIPT] = {
		name : "dialog",
		shortName : "dialog",
		propertyId : "dlg",
		defaultScript : 'hi there!', // todo : changed based on sprite type?
		selectControl : null,
	};

	scriptCueTypes[ARG_KEY.FRAME_TICK_SCRIPT] = {
		name : "on frame tick",
		shortName : "tick",
		propertyId : "tickDlgId",
		defaultScript :
			'{>>\n' +
			'    {FN {FRM}\n' +
			'        {HOP THIS "DWN"}\n' +
			'    }\n' +
			'}',
		selectControl : null,
		selectRoot : null,
	};

	scriptCueTypes[ARG_KEY.KNOCK_INTO_SCRIPT] = {
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

	scriptCueTypes[ARG_KEY.BUTTON_DOWN_SCRIPT] = {
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

	// todo : better API?
	this.GetDefinitions = function() {
		return scriptCueTypes;
	};

	// todo : name?
	this.ClearAllContainingScript = function(scriptId, tileId) {
		for (var id in scriptCueTypes) {
			if (id in tile[tileId] && tile[tileId][id] === scriptId) {
				tile[tileId][id] = null;
			}
		}

		refreshGameData();
	}
}

function ScriptCueControl(parentPanelId) {
	var drawingId = null;

	var curCueId = ARG_KEY.DIALOG_SCRIPT;
	var scriptCues = new ScriptCues();
	var cueTypes = scriptCues.GetDefinitions();

	this.SetDrawing = function(id) {
		drawingId = id;
		UpdateScriptIdSelectOptions();

		setSelected(ARG_KEY.DIALOG_SCRIPT);

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
			id = tile[drawingId][cueTypes[curCueId].propertyId];
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
	settingsButton.appendChild(iconUtils.CreateIcon("sequence"));
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

		showPanel("scriptPanel", parentPanelId);
	};
	controlDiv.appendChild(openButton);

	var editorDiv = document.createElement("div");
	editorDiv.style.display = "flex";
	editorDiv.style.marginTop = "5px";
	editorDiv.classList.add("dialogBoxContainer");
	div.appendChild(editorDiv);

	function createNewScript(scriptCue, src, openTool) {
		var nextDlgId = nextB256Id(dialog, 1, DEFAULT_REGISTRY_SIZE);

		if (nextDlgId != null) {
			var nextName = "";

			if (findTool) {
				nextName += findTool.GetDisplayName("drawing", drawingId);
				nextName += " ";
			}

			nextName += scriptCue.shortName;

			nextName = CreateDefaultName(nextName, dialog, true);

			dialog[nextDlgId] = createScript(nextDlgId, nextName, src);

			curDlgId = nextDlgId;

			scriptCue.selectControl.UpdateOptions();
			scriptCue.selectControl.SetSelection(curDlgId);

			if (openTool) {
				scriptCue.selectControl.OpenTool();
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
			var scriptRoot = scriptInterpreter.Parse(e.target.value, DialogWrapMode.Yes);
			var scriptStr = scriptInterpreter.Serialize(scriptRoot);

			// handle one line scripts: a little hard coded
			if (scriptStr.indexOf("\n") === -1) {
				var startOffset = SYM_KEY.OPEN.length + SYM_KEY.DIALOG.length + 1;
				var endOffset = startOffset + SYM_KEY.CLOSE.length;
				scriptStr = scriptStr.substr(startOffset, scriptStr.length - endOffset);
			}

			dialog[curDlgId].src = scriptStr;

			refreshGameData();
		}
		else if (curCueId === ARG_KEY.DIALOG_SCRIPT && tile[drawingId].type != TYPE_KEY.AVATAR) {
			createNewScript(cueTypes[curCueId], e.target.value, false);
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

	function setSelected(id) {
		curCueId = id;
		labelTextSpan.innerText = cueTypes[curCueId].name;

		// todo : strip off the outer dialog block stuff
		var curDlgId = selectedDialogId();

		if (curDlgId != null) {
			var scriptRoot = scriptInterpreter.Parse(dialog[curDlgId].src);
			textArea.value = scriptInterpreter.SerializeUnwrapped(scriptRoot);
		}
		else {
			textArea.value = "";
		}
	}

	function UpdateScriptIdSelectOptions() {
		function createScriptSelectControl(cueId) {
			var scriptCue = cueTypes[cueId];

			var selectCue = document.createElement("div");
			selectCue.classList.add("dialogEvent");
			dialogIdSelectRoot.appendChild(selectCue);

			var selectCueEditButton = document.createElement("button");
			selectCue.appendChild(selectCueEditButton);

			function updateCueEditButton() {
				var curDlgId = tile[drawingId][scriptCue.propertyId];
				var curIcon = curDlgId === null ? "add" : "edit";
				selectCueEditButton.innerHTML = "";
				selectCueEditButton.appendChild(iconUtils.CreateIcon(curIcon));
			}

			selectCueEditButton.onclick = function() {
				var curDlgId = tile[drawingId][scriptCue.propertyId];

				if (curDlgId === null) {
					createNewScript(scriptCue, scriptCue.defaultScript, true);
					curCueId = cueId;
				}
				else {
					setSelected(cueId);
					ChangeSettingsVisibility(false);
				}

				updateCueEditButton();
			}

			var selectCueName = document.createElement("span");
			selectCueName.innerText = scriptCue.name + ":";
			selectCueName.classList.add("selectCueName");
			selectCue.appendChild(selectCueName);

			scriptCue.selectControl = findTool.CreateSelectControl(
				"script",
				{
					onSelectChange : function(id) {
						tile[drawingId][scriptCue.propertyId] = id;
						updateCueEditButton();
						UpdateSettingsButtonDisabled(true);
						refreshGameData();
					},
					toolId : parentPanelId,
					filters : ["script", "no_title"],
					getSelectMessage : function() {
						// todo : make less awkward sounding!
						return "select script for " + scriptCue.name + "...";
					},
					hasNoneOption : true,
				});

			selectCue.appendChild(scriptCue.selectControl.GetElement());

			scriptCue.selectRoot = selectCue;
		}

		if (findTool) {
			for (var id in cueTypes) {
				var scriptCue = cueTypes[id];
				if (scriptCue.selectControl === null) {
					createScriptSelectControl(id);
				}
			}
		}

		if (tile[drawingId]) { // todo : why would this fail?
			for (var id in cueTypes) {
				var scriptCue = cueTypes[id];
				if (scriptCue.selectControl) {
					if (id === ARG_KEY.DIALOG_SCRIPT && tile[drawingId].type === TYPE_KEY.AVATAR) {
						scriptCue.selectRoot.style.display = "none";
					}
					else {
						var curScriptId = tile[drawingId][scriptCue.propertyId];
						scriptCue.selectControl.UpdateOptions();
						scriptCue.selectControl.SetSelection(curScriptId);
						scriptCue.selectRoot.style.display = "flex";
					}
				}
			}
		}
	}

	UpdateScriptIdSelectOptions();

	events.Listen("new_dialog", function() { UpdateScriptIdSelectOptions(); });

	events.Listen("dialog_update", function(event) {
		if (event.dialogId === selectedDialogId() && event.editorId != "_dialog_control_") {
			setSelected(curCueId); // hack to refresh text..
		}
	});

	function ChangeSettingsVisibility(visible) {
		showSettings = visible;
		editorDiv.style.display = showSettings ? "none" : "flex";
		dialogIdSelectRoot.style.display = showSettings ? "block" : "none";
		openButton.style.display = showSettings ? "none" : "inline";

		openButton.disabled = false;
		var cuePropertyId = cueTypes[curCueId].propertyId;
		var doesCueExist = (cuePropertyId in tile[drawingId]) && (tile[drawingId][cuePropertyId] != null);
		if (!showSettings && !doesCueExist) {
			openButton.disabled = true;
		}

		settingsButton.innerHTML = "";
		settingsButton.appendChild(iconUtils.CreateIcon(visible ? "text_edit" : "sequence"));

		UpdateSettingsButtonDisabled(visible);
	}

	// todo : UI question.. do I really want the settings button on in settings mode??
	function UpdateSettingsButtonDisabled(visible) {
		settingsButton.disabled = false;

		var cuePropertyId = cueTypes[curCueId].propertyId;

		if (visible) {
			var doesCueExist = (cuePropertyId in tile[drawingId]) && (tile[drawingId][cuePropertyId] != null);
			var allowsTextboxToCreate = (curCueId === ARG_KEY.DIALOG_SCRIPT) && (tile[drawingId].type != TYPE_KEY.AVATAR);

			settingsButton.disabled = !doesCueExist && !allowsTextboxToCreate;
		}
	}

	settingsButton.onclick = function() {
		ChangeSettingsVisibility(!showSettings);

		if (showSettings) {
			labelTextSpan.innerText = "script cues"; // todo : localize // todo : best name?
		}
		else {
			setSelected(curCueId);
		}
	}

	this.GetElement = function() {
		return div;
	}

	setSelected(ARG_KEY.DIALOG_SCRIPT);
}

// todo : broken -- fix this!
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