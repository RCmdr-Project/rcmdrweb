/* TheLaTeXLab - Citations & Bibliography: Classic Editor (TinyMCE) button.
 *
 * Registers a "TheLaTeXLab" toolbar button that opens the same shared
 * modal the block editor uses (window.thelatexlabModal), then inserts the in-text
 * citation span at the cursor. Same markup as Gutenberg, so the two editors
 * are interchangeable. No em-dashes in this codebase.
 */
( function () {
	'use strict';
	if ( ! window.tinymce ) { return; }

	tinymce.PluginManager.add( 'thelatexlab_citation', function ( editor ) {
		var strings = ( window.THELATEXLAB_EDITOR && window.THELATEXLAB_EDITOR.strings ) || {};

		editor.addButton( 'thelatexlab_citation', {
			text: strings.buttonLabel || 'TheLaTeXLab',
			icon: false,
			tooltip: strings.buttonLabel || 'TheLaTeXLab',
			onclick: function () {
				if ( ! window.thelatexlabModal ) { return; }
				window.thelatexlabModal.open( {
					onInsert: function ( ref ) {
						var html = '<span class="scholar-cite" data-ref="' + ref.id + '">' +
							( ref.intext || '(citation)' ) + '</span>';
						// Never nest a citation inside another: if the caret is
						// within an existing citation span, move it to just after
						// that span before inserting, so the two stay siblings.
						try {
							var node = editor.selection ? editor.selection.getNode() : null;
							var cite = node && node.closest ? node.closest( 'span.scholar-cite' ) : null;
							if ( cite && cite.parentNode && editor.dom ) {
								var rng = editor.dom.createRng();
								rng.setStartAfter( cite );
								rng.setEndAfter( cite );
								editor.selection.setRng( rng );
							}
						} catch ( e ) {}
						editor.insertContent( html );
					}
				} );
			}
		} );
	} );
} )();
