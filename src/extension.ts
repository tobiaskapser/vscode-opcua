// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
	ClientSession,
	ReferenceDescription,
	AttributeIds
  } from "node-opcua";

const connectionStrategy = {
	initialDelay: 1000,
	maxRetry: 1
};

const client = OPCUAClient.create({
	applicationName: "VS Code OPC UA",
	connectionStrategy: connectionStrategy,
	securityMode: MessageSecurityMode.None,
	securityPolicy: SecurityPolicy.None,
	endpointMustExist: false
});

let session: null | ClientSession = null;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const opcuaProvider = new OPCUAProvider();
	const opcuaValueExplorer = new OPCUAValueExplorer();

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-opcua" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let connect = vscode.commands.registerCommand('vscode-opcua.connect', async () => {

		const host = String(await vscode.window.showInputBox({
			"placeHolder": "hostname",
			"title": "Enter hostname",
			"value": "localhost",
			"prompt": "Please enter the hostname of the OPC UA server"
		}));

		const port = String(await vscode.window.showInputBox({
			"placeHolder": "port",
			"title": "Enter port",
			"value": "4840",
			"prompt": "Please enter the port of the OPC UA server"
		}));


		const endpointUrl = `opc.tcp://${host}:${port}`;

		try{
			await client.connect(endpointUrl);
			session = await client.createSession();
			vscode.window.showInformationMessage("Connected!");
		} catch (e) {
			vscode.window.showInformationMessage(String(e));
			return false;
		}
		
		vscode.window.createTreeView('OPC_UA_Explorer', {
			treeDataProvider: opcuaProvider
		  });
		vscode.window.createTreeView('OPC_UA_Values', {
			treeDataProvider: opcuaValueExplorer
		  });
		
	});

	let disconnect = vscode.commands.registerCommand('vscode-opcua.disconnect', async () => {

		try{
			if (session){
				await session.close();
			}
			await client.disconnect();
			vscode.window.showInformationMessage(String("Disconnected!"));
		} catch (e) {
			vscode.window.showInformationMessage(String(e));
			return false;
		}
		
	});

	let addToWatchlist = vscode.commands.registerCommand('vscode-opcua.addToWatchlist', async (element: OPCUAElement) => {
		opcuaValueExplorer.addToWatchlist(element);
		opcuaValueExplorer.refresh();
	});

	let removeFromWatchlist = vscode.commands.registerCommand('vscode-opcua.removeFromWatchlist', async (element: OPCUAElementValue) => {
		opcuaValueExplorer.removeFromWatchlist(element);
		opcuaValueExplorer.refresh();
	});

	let copyValueToClipBoard = vscode.commands.registerCommand('vscode-opcua.copyValueToClipBoard', async (element: OPCUAElementValue) => {
		if (element.description){
			vscode.env.clipboard.writeText(String(element.description)); 
		}
	});

	let reloadValues = vscode.commands.registerCommand('vscode-opcua.reloadValues', () => {
		console.log("Refresh");
		opcuaValueExplorer.reloadValues();
		opcuaValueExplorer.refresh();
	});


	context.subscriptions.push(connect, disconnect, addToWatchlist, removeFromWatchlist, copyValueToClipBoard, reloadValues);
}



// This method is called when your extension is deactivated
export function deactivate() {}


export class OPCUAProvider implements vscode.TreeDataProvider<OPCUAElement> {
  constructor() {}

  getTreeItem(element: OPCUAElement): vscode.TreeItem {
    return element;
  }

  getChildren(element: OPCUAElement): Thenable<OPCUAElement[]> {
    if (!session) {
      vscode.window.showInformationMessage('No OPC UA session!');
      return Promise.resolve([]);
    } else {
		if (element) {
			return Promise.resolve(this.getOPCUAElement(session, element));
		} else {
			return Promise.resolve(this.getOPCUAElement(session, "RootFolder"));
	
		}}}


	private async getOPCUAElement(session: ClientSession, element: OPCUAElement | string): Promise<OPCUAElement[]> {
		let browseResult;
		if (typeof element === 'string'){
			browseResult = await session.browse(element);
		} else {
			browseResult = await session.browse(element.reference.nodeId.toString());
		}

		
		if (browseResult && browseResult.references){
			const results = browseResult.references.map((reference) => {
				return new OPCUAElement(reference);
			});
		return results;
		}
		return [];

	}
}

class OPCUAElement extends vscode.TreeItem {
  constructor(
	public readonly reference: ReferenceDescription,
  ) {

	let collapsibleState;
	let iconPath;
	let contextValue;
	if (reference.nodeClass === 2){
		collapsibleState = vscode.TreeItemCollapsibleState.None;
		contextValue = "variable";
		iconPath = new vscode.ThemeIcon("symbol-variable");
	} else {
		collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
		iconPath = new vscode.ThemeIcon("symbol-object");
	}

    super(reference.browseName.toString(), collapsibleState);
    this.tooltip = this.reference.browseName.toString();

	this.iconPath = iconPath;

	this.contextValue = contextValue;

  }

}


export class OPCUAValueExplorer implements vscode.TreeDataProvider<OPCUAElementValue> {
	constructor() {}

	_registeredValues: any = new Object();
  
	getTreeItem(element: OPCUAElementValue): vscode.TreeItem {
	  return element;
	}
  
	getChildren(): Thenable<OPCUAElementValue[]> {
		return Promise.resolve(Object.values(this._registeredValues));
  	}

	addToWatchlist(element: OPCUAElement) {
		this._registeredValues[element.reference.nodeId.toString()] = new OPCUAElementValue(element);
	}

	removeFromWatchlist(element: OPCUAElementValue) {
		delete this._registeredValues[element.element.reference.nodeId.toString()];
	}


	private _onDidChangeTreeData: vscode.EventEmitter<OPCUAElementValue | undefined | null | void> = new vscode.EventEmitter<OPCUAElementValue | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<OPCUAElementValue | undefined | null | void> = this._onDidChangeTreeData.event;
  
	refresh(): void {
	  this._onDidChangeTreeData.fire();
	}

	reloadValues(): void {
		this.getChildren().then((result) => result.forEach(element => {
		  element.readValue();
		}));
	  };

}

  class OPCUAElementValue extends vscode.TreeItem {
	constructor(
		public readonly element: OPCUAElement,
	) {
	  	super("", vscode.TreeItemCollapsibleState.None);
		this.readValue();
		this.iconPath = new vscode.ThemeIcon("symbol-numeric");
	}

	async readValue(){
		let dataValue;
		const maxAge = 0;
		const nodeToRead = {
		nodeId: this.element.reference.nodeId.toString(),
		attributeId: AttributeIds.Value
		};
		
		if (session){
			dataValue = await (await session.read(nodeToRead, maxAge)).value.value;
			this.label = `${this.element.reference.browseName.toString()}:`;
			this.description = String(dataValue);
			this.tooltip = String(dataValue);
		}	
		
  }
}
  