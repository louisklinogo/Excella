import type {
	DependencyEdge,
	DependencyGateway,
	DependencyGraphNode,
	SelectionDependencyGraph,
} from "@excella/core/excel/dependency-gateway";
import type { SelectionContext } from "@excella/core/excel/context-snapshot";

export class OfficeJsDependencyGateway implements DependencyGateway {
	async getSelectionDependencyGraph(
		selection: SelectionContext,
		maxNodes: number,
	): Promise<SelectionDependencyGraph> {
		if (!selection.worksheetName || !selection.rangeAddress) {
			return {
				rootSelectionAddress: selection.rangeAddress ?? "",
				nodes: [],
				edges: [],
				truncated: false,
			};
		}

		const result: SelectionDependencyGraph = {
			rootSelectionAddress: `${selection.worksheetName}!${selection.rangeAddress}`,
			nodes: [],
			edges: [],
			truncated: false,
		};

		const nodeMap = new Map<string, DependencyGraphNode>();

		const addNode = (address: string): DependencyGraphNode => {
			const existing = nodeMap.get(address);
			if (existing) {
				return existing;
			}
			const node: DependencyGraphNode = { address };
			nodeMap.set(address, node);
			return node;
		};

		await Excel.run(async (context) => {
			const workbook = context.workbook;
			const worksheet = workbook.worksheets.getItem(selection.worksheetName!);
			const rootRange = worksheet.getRange(selection.rangeAddress!);
			rootRange.load(["address"]);

			await context.sync();

			const rootNode = addNode(rootRange.address);

			let precedents: Excel.RangeAreas | null = null;
			try {
				precedents = rootRange.getDirectPrecedents();
			} catch {
				precedents = null;
			}

			if (!precedents) {
				return;
			}

			precedents.load(["areas/address"]);
			await context.sync();

			const edges: DependencyEdge[] = [];
			for (const area of precedents.areas) {
				const address = area.address;
				const node = addNode(address);
				edges.push({ from: node, to: rootNode });
				if (nodeMap.size >= maxNodes) {
					result.truncated = true;
					break;
				}
			}

			result.nodes = Array.from(nodeMap.values());
			result.edges = edges;
		});

		return result;
	}
}
