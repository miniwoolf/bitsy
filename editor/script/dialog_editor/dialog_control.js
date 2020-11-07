/*
 TODO
 - consider re-implementing check for code complexity?
*/

function DialogControl(parentPanelId) {
	var drawingId = null;
	var curEventId = ARG_KEY.DIALOG_SCRIPT;

	this.SetDrawing = function(id) {
		drawingId = id;
		UpdateDialogIdSelectOptions();
		setSelectedEvent(ARG_KEY.DIALOG_SCRIPT);
		ChangeSettingsVisibility(false);
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

	// todo : improve styling of this
	var textArea = document.createElement("textarea");
	textArea.cols = 32;
	textArea.rows = 2;
	textArea.oninput = function(e) {
		// todo : delete empty dialogs?
		var curDlgId = selectedDialogId();
		if (curDlgId != null) {
			// todo : ADD wrapping dialog block for multiline scripts
			dialog[curDlgId].src = e.target.value;
		}
	}
	editorDiv.appendChild(textArea);

	var dialogIdSelectRoot = document.createElement("div");
	dialogIdSelectRoot.style.display = "none";
	div.appendChild(dialogIdSelectRoot);

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
			'{->\n' +
			'    {FN {FRM}\n' +
			'        {HOP "RGT"}\n' +
			'    }\n' +
			'}',
		selectControl : null,
	};

	dialogEventTypes[ARG_KEY.KNOCK_INTO_SCRIPT] = {
		name : "on knock into",
		shortName : "knock",
		propertyId : "knockDlgId",
		defaultScript : // todo : is this the script I want?
			'{->\n' +
			'    {FN {OTHER}\n' +
			'        {RID OTHER}\n' +
			'    }\n' +
			'}',
		selectControl : null,
	};

	dialogEventTypes[ARG_KEY.BUTTON_DOWN_SCRIPT] = {
		name : "on button",
		shortName : "button",
		propertyId : "buttonDownDlgId",
		defaultScript : // todo : is this the script I want?
			'{->\n' +
			'    {FN {BTN HLD}\n' +
			'        {-> player pressed {SAY BTN}}\n' +
			'    }\n' +
			'}',
		selectControl : null,
	};

	function setSelectedEvent(id) {
		curEventId = id;
		labelTextSpan.innerText = dialogEventTypes[curEventId].name;

		// todo : strip off the outer dialog block stuff
		var curDlgId = selectedDialogId();
		if (curDlgId != null) {
			textArea.value = dialog[curDlgId].src;
		}
	}

	function UpdateDialogIdSelectOptions() {
		function createDialogSelectControl(eventId) {
			var dialogEvent = dialogEventTypes[eventId];

			var selectEvent = document.createElement("div");
			selectEvent.classList.add("paintSetting");
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
					var nextDlgId = nextObjectId(sortedDialogIdList());

					var nextName = "";

					if (findTool) {
						nextName += findTool.GetDisplayName("drawing", drawingId);
						nextName += " ";
					}

					nextName += dialogEvent.shortName;

					nextName = CreateDefaultName(nextName, dialog, true);

					dialog[nextDlgId] = createScript(nextDlgId, nextName, dialogEvent.defaultScript);

					curDlgId = nextDlgId;

					dialogEvent.selectControl.UpdateOptions();
					dialogEvent.selectControl.SetSelection(curDlgId);
					dialogEvent.selectControl.OpenTool();

					refreshGameData();

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
					var curDlgId = tile[drawingId][dialogEvent.propertyId];
					dialogEvent.selectControl.UpdateOptions();
					dialogEvent.selectControl.SetSelection(curDlgId);
				}
			}
		}
	}

	UpdateDialogIdSelectOptions();

	events.Listen("new_dialog", function() { UpdateDialogIdSelectOptions(); });
	events.Listen("dialog_update", function(event) {
		// TODO
	})

	function ChangeSettingsVisibility(visible) {
		showSettings = visible;
		editorDiv.style.display = showSettings ? "none" : "flex";
		dialogIdSelectRoot.style.display = showSettings ? "block" : "none";
		openButton.style.display = showSettings ? "none" : "inline";

		settingsButton.innerHTML = "";
		settingsButton.appendChild(iconUtils.CreateIcon(visible ? "text_edit" : "settings"));
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