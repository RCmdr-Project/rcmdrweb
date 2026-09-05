/* TheLaTeXLab - Citations & Bibliography: frontend behavior.
 *
 * Two jobs, both progressive enhancement (the page is fully readable
 * without JS):
 *   1. Tap / click an in-text citation to show a popover with the full
 *      reference (mobile-friendly: tap, not hover-only).
 *   2. Light client-side sort / filter on publications lists.
 *
 * No build step; plain ES5-friendly DOM. No em-dashes in this codebase.
 */
( function () {
	'use strict';

	function buildPopover() {
		var el = document.createElement( 'div' );
		el.className = 'scholar-popover';
		el.setAttribute( 'role', 'tooltip' );
		el.hidden = true;
		document.body.appendChild( el );
		return el;
	}

	function refEntryHtml( refId ) {
		var entry = document.getElementById( 'scholar-ref-' + refId );
		return entry ? entry.innerHTML : '';
	}

	function initPopovers() {
		var pop = null;

		document.addEventListener( 'click', function ( e ) {
			var cite = e.target.closest ? e.target.closest( '.scholar-cite' ) : null;

			if ( ! cite ) {
				if ( pop ) {
					pop.hidden = true;
				}
				return;
			}

			var refId = cite.getAttribute( 'data-ref' );
			var html = refEntryHtml( refId );
			if ( ! html ) {
				return; // let the anchor jump to the bibliography
			}

			e.preventDefault();
			if ( ! pop ) {
				pop = buildPopover();
			}
			pop.innerHTML = html;
			pop.hidden = false;

			var rect = cite.getBoundingClientRect();
			var top = window.scrollY + rect.bottom + 6;
			var left = window.scrollX + rect.left;
			pop.style.top = top + 'px';
			pop.style.left = Math.max( 8, left ) + 'px';
		} );

		document.addEventListener( 'keydown', function ( e ) {
			if ( 'Escape' === e.key && pop ) {
				pop.hidden = true;
			}
		} );
	}

	function initPublications() {
		var lists = document.querySelectorAll( '.scholar-publications[data-sortable="1"]' );
		Array.prototype.forEach.call( lists, function ( container ) {
			// Sorting / filtering controls are a follow-up; the data
			// attributes (data-year, data-type) are already emitted on
			// each item so this can be wired without markup changes.
			void container;
		} );
	}

	function initCopyButtons() {
		document.addEventListener( 'click', function ( e ) {
			var btn = e.target.closest ? e.target.closest( '.scholar-copy__btn' ) : null;
			if ( ! btn ) {
				return;
			}
			e.preventDefault();
			var text = btn.getAttribute( 'data-thelatexlab-copy' ) || '';
			var done = function () {
				var original = btn.textContent;
				btn.textContent = btn.getAttribute( 'data-copied' ) || 'Copied';
				setTimeout( function () { btn.textContent = original; }, 1500 );
			};
			if ( navigator.clipboard && navigator.clipboard.writeText ) {
				navigator.clipboard.writeText( text ).then( done ).catch( function () {} );
			} else {
				var ta = document.createElement( 'textarea' );
				ta.value = text;
				document.body.appendChild( ta );
				ta.select();
				try { document.execCommand( 'copy' ); done(); } catch ( err ) {}
				document.body.removeChild( ta );
			}
		} );
	}

	function init() {
		initPopovers();
		initPublications();
		initCopyButtons();
	}

	if ( document.readyState !== 'loading' ) {
		init();
	} else {
		document.addEventListener( 'DOMContentLoaded', init );
	}
} )();
