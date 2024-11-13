import { useBlockProps } from "@wordpress/block-editor";

export default function save({ attributes }) {
	const {
		selectedBlockId,
		dispOfItems,
		isArrowButton,
		groupBlockAttributes,
		numBlockAttributes,
		dummyBlockAttributes,
		forwardBlockAttributes,
		backBlockAttributes,
	} = attributes;

	return (
		<div {...useBlockProps.save()}>
			<div
				id={`page_${selectedBlockId}`}
				data-disp_items={dispOfItems}
				data-is_arrow={isArrowButton}
				data-group_attributes={JSON.stringify(groupBlockAttributes)}
				data-num_attributes={JSON.stringify(numBlockAttributes)}
				data-dummy_attributes={JSON.stringify(dummyBlockAttributes)}
				data-forward_attributes={JSON.stringify(forwardBlockAttributes)}
				data-back_attributes={JSON.stringify(backBlockAttributes)}
			/>
		</div>
	);
}
