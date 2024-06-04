import { useBlockProps, InnerBlocks } from "@wordpress/block-editor";

export default function save({ attributes }) {
	const {
		numberOfItems,
		selectedRest,
		taxRelateType,
		choiceTerms,
		choiceFields,
	} = attributes;
	return (
		<div
			{...useBlockProps.save()}
			data-number_of_items={numberOfItems}
			data-selected_rest={selectedRest}
			data-tax_relate_type={taxRelateType}
			data-choice_terms={JSON.stringify(choiceTerms)}
		>
			<div className="post_unit unit_hide">
				<InnerBlocks.Content />
			</div>
		</div>
	);
}
