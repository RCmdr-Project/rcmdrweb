/* TheLaTeXLab - Citations & Bibliography: block editor integration.
 *
 * Three pieces, all buildless (global wp.* packages, no JSX):
 *   1. Inline format `thelatexlab/citation`: a toolbar button that inserts an
 *      in-text citation span at the caret. Inline is the correct primitive
 *      for a mid-sentence citation (a block would be block-level).
 *   2. Block `thelatexlab/bibliography`: dynamic; renders where placed.
 *   3. Block `thelatexlab/publications`: dynamic publications list.
 *
 * The inserted span (<span class="scholar-cite" data-ref="ID">text</span>)
 * is static in post content, so deactivating the plugin leaves readable
 * text. No em-dashes in this codebase.
 */
( function ( wp ) {
	'use strict';
	if ( ! wp || ! wp.richText || ! wp.blocks ) { return; }

	var el = wp.element.createElement;
	var __ = ( wp.i18n && wp.i18n.__ ) || function ( s ) { return s; };
	var registerFormatType = wp.richText.registerFormatType;
	var insert = wp.richText.insert;
	var create = wp.richText.create;
	var RichTextToolbarButton = wp.blockEditor.RichTextToolbarButton;

	// 1. Inline citation format.
	registerFormatType( 'thelatexlab/citation', {
		title: __( 'TheLaTeXLab', 'thelatexlab-citations-bibliography' ),
		tagName: 'span',
		className: 'scholar-cite',
		attributes: { ref: 'data-ref' },
		edit: function ( props ) {
			function onClick() {
				if ( ! window.thelatexlabModal ) { return; }
				window.thelatexlabModal.open( {
					onInsert: function ( ref ) {
						var html = '<span class="scholar-cite" data-ref="' + ref.id + '">' +
							( ref.intext || '(citation)' ) + '</span>';
						props.onChange( insert( props.value, create( { html: html } ) ) );
					}
				} );
			}
			var button = el( RichTextToolbarButton, {
				icon: 'book-alt',
				// Toolbar / "More" menu label. The shortcut hint below shows
				// access+c (Control+Option+C on Mac, Shift+Alt+C on Windows).
				title: __( 'TheLaTeXLab', 'thelatexlab-citations-bibliography' ),
				onClick: onClick,
				isActive: props.isActive,
				shortcutType: 'access',
				shortcutCharacter: 'c'
			} );
			// RichTextToolbarButton's shortcut props only render the hint; bind
			// the actual keystroke ourselves while a rich text is focused.
			var KeyboardShortcuts = wp.components && wp.components.KeyboardShortcuts;
			if ( ! KeyboardShortcuts ) { return button; }
			var combo = ( wp.keycodes && wp.keycodes.rawShortcut && wp.keycodes.rawShortcut.access )
				? wp.keycodes.rawShortcut.access( 'c' ) : 'ctrl+alt+c';
			var shortcuts = {};
			shortcuts[ combo ] = function ( e ) { if ( e && e.preventDefault ) { e.preventDefault(); } onClick(); };
			return el( wp.element.Fragment, {}, button,
				el( KeyboardShortcuts, { bindGlobal: true, shortcuts: shortcuts } )
			);
		}
	} );

	// 1b. One-time discoverability tip. The inline citation control lives in
	// the formatting toolbar's "More" menu, which new users do not find on
	// their own, so we surface a dismissible notice the first time the block
	// editor loads. Dismissal is remembered per browser.
	( function () {
		try {
			if ( window.localStorage && '1' === localStorage.getItem( 'thelatexlabCiteTipDismissed' ) ) { return; }
			if ( ! wp.data || ! wp.data.dispatch ) { return; }
			var notices = wp.data.dispatch( 'core/notices' );
			if ( ! notices || ! notices.createInfoNotice ) { return; }
			var cfg = window.THELATEXLAB_EDITOR || {};
			var actions = [ {
				label: __( 'Do not show again', 'thelatexlab-citations-bibliography' ),
				onClick: function () {
					try { localStorage.setItem( 'thelatexlabCiteTipDismissed', '1' ); } catch ( e ) {}
					try { wp.data.dispatch( 'core/notices' ).removeNotice( 'thelatexlab-cite-tip' ); } catch ( e ) {}
				}
			} ];
			if ( cfg.helpUrl ) {
				actions.unshift( { label: __( 'How to use', 'thelatexlab-citations-bibliography' ), url: cfg.helpUrl } );
			}
			notices.createInfoNotice(
				__( 'TheLaTeXLab Citations: to cite a source, click inside a paragraph, open the down-arrow "More" menu in the formatting toolbar, and choose "Insert Citation".', 'thelatexlab-citations-bibliography' ),
				{ id: 'thelatexlab-cite-tip', isDismissible: true, actions: actions }
			);
		} catch ( e ) {}
	} )();

	// 2 + 3. Dynamic blocks (save returns null; PHP render_callback emits).
	var useBlockProps = wp.blockEditor.useBlockProps;

	wp.blocks.registerBlockType( 'thelatexlab/bibliography', {
		apiVersion: 2,
		title: __( 'Bibliography', 'thelatexlab-citations-bibliography' ),
		description: __( 'Renders the list of references cited in this post.', 'thelatexlab-citations-bibliography' ),
		icon: 'list-view',
		category: 'widgets',
		supports: { html: false, multiple: false },
		edit: function () {
			return el(
				'div',
				useBlockProps( { className: 'thelatexlab-editor-placeholder' } ),
				el( 'strong', {}, __( 'Bibliography', 'thelatexlab-citations-bibliography' ) ),
				el( 'p', {}, __( 'The formatted reference list renders here on the front end.', 'thelatexlab-citations-bibliography' ) )
			);
		},
		save: function () { return null; }
	} );

	var TextControl = wp.components && wp.components.TextControl;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelBody = wp.components && wp.components.PanelBody;

	wp.blocks.registerBlockType( 'thelatexlab/publications', {
		apiVersion: 2,
		title: __( 'Publications List', 'thelatexlab-citations-bibliography' ),
		description: __( 'A sortable, filterable list of all references.', 'thelatexlab-citations-bibliography' ),
		icon: 'editor-ul',
		category: 'widgets',
		attributes: {
			style: { type: 'string', 'default': '' },
			tag: { type: 'string', 'default': '' },
			type: { type: 'string', 'default': '' },
			year: { type: 'string', 'default': '' }
		},
		supports: { html: false },
		edit: function ( props ) {
			var a = props.attributes;
			var set = props.setAttributes;
			var inspector = null;
			if ( InspectorControls && PanelBody && TextControl ) {
				inspector = el( InspectorControls, {},
					el( PanelBody, { title: __( 'Filters', 'thelatexlab-citations-bibliography' ) },
						el( TextControl, { label: __( 'Tag', 'thelatexlab-citations-bibliography' ), value: a.tag, onChange: function ( v ) { set( { tag: v } ); } } ),
						el( TextControl, { label: __( 'Type', 'thelatexlab-citations-bibliography' ), value: a.type, onChange: function ( v ) { set( { type: v } ); } } ),
						el( TextControl, { label: __( 'Year', 'thelatexlab-citations-bibliography' ), value: a.year, onChange: function ( v ) { set( { year: v } ); } } )
					)
				);
			}
			return el( wp.element.Fragment, {},
				inspector,
				el( 'div', useBlockProps( { className: 'thelatexlab-editor-placeholder' } ),
					el( 'strong', {}, __( 'Publications List', 'thelatexlab-citations-bibliography' ) ),
					el( 'p', {}, __( 'Your references render here as a list on the front end.', 'thelatexlab-citations-bibliography' ) )
				)
			);
		},
		save: function () { return null; }
	} );
} )( window.wp );
