/* TheLaTeXLab - Citations & Bibliography: shared insert-citation modal.
 *
 * One modal, used by both the Gutenberg inline format and the Classic
 * Editor button. It talks only to the plugin's own REST routes (thelatexlab/v1),
 * never the external API, so caching, dedupe, and config stay server-side.
 *
 * Public API:  window.thelatexlabModal.open({ onInsert: function (ref) {...} })
 *   ref = { id, intext, html }
 *
 * Plain DOM, no build step. No em-dashes in this codebase.
 */
( function () {
	'use strict';

	var cfg = window.THELATEXLAB_EDITOR || { rest: '', nonce: '', strings: {}, defaultStyle: 'apa' };
	var S = cfg.strings || {};

	function t( key, fallback ) {
		return S[ key ] || fallback || key;
	}

	function api( path, method, body ) {
		return fetch( cfg.rest + path, {
			method: method,
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': cfg.nonce
			},
			body: body ? JSON.stringify( body ) : undefined
		} ).then( function ( r ) { return r.json(); } );
	}

	function elt( tag, attrs, children ) {
		var node = document.createElement( tag );
		attrs = attrs || {};
		Object.keys( attrs ).forEach( function ( k ) {
			if ( 'class' === k ) { node.className = attrs[ k ]; }
			else if ( 'text' === k ) { node.textContent = attrs[ k ]; }
			else if ( 'html' === k ) { node.innerHTML = attrs[ k ]; }
			else { node.setAttribute( k, attrs[ k ] ); }
		} );
		( children || [] ).forEach( function ( c ) {
			node.appendChild( typeof c === 'string' ? document.createTextNode( c ) : c );
		} );
		return node;
	}

	function buildModal( onInsert ) {
		var overlay = elt( 'div', { 'class': 'thelatexlab-modal-overlay' } );
		var modal = elt( 'div', { 'class': 'thelatexlab-modal', role: 'dialog', 'aria-modal': 'true' } );

		var titleId = 'thelatexlab-modal-title-' + Math.random().toString( 36 ).slice( 2 );
		modal.setAttribute( 'aria-labelledby', titleId );
		var header = elt( 'div', { 'class': 'thelatexlab-modal__header' }, [
			elt( 'h2', { 'class': 'thelatexlab-modal__title', id: titleId, text: t( 'title', 'Insert Citation' ) } )
		] );

		var tabs = elt( 'div', { 'class': 'thelatexlab-modal__tabs', role: 'tablist' } );
		var bodies = elt( 'div', { 'class': 'thelatexlab-modal__bodies', role: 'tabpanel' } );
		var status = elt( 'div', { 'class': 'thelatexlab-modal__status', role: 'status', 'aria-live': 'polite' } );

		var tabDefs = [
			{ key: 'paste', label: t( 'tabPaste', 'Paste identifier' ), build: buildPaste },
			{ key: 'search', label: t( 'tabSearch', 'Search my references' ), build: buildSearch },
			{ key: 'manual', label: t( 'tabManual', 'Add manually' ), build: buildManual }
		];

		// Focus management: remember what was focused, restore on close.
		var previouslyFocused = document.activeElement;

		function close() {
			document.removeEventListener( 'keydown', onKey );
			if ( overlay.parentNode ) { overlay.parentNode.removeChild( overlay ); }
			if ( previouslyFocused && previouslyFocused.focus ) { previouslyFocused.focus(); }
		}

		function focusables() {
			return Array.prototype.slice.call(
				modal.querySelectorAll( 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])' )
			);
		}

		function onKey( e ) {
			if ( 'Escape' === e.key ) { close(); return; }
			if ( 'Tab' !== e.key ) { return; }
			// Trap focus inside the modal.
			var f = focusables();
			if ( ! f.length ) { return; }
			var first = f[ 0 ];
			var last = f[ f.length - 1 ];
			if ( e.shiftKey && document.activeElement === first ) {
				e.preventDefault();
				last.focus();
			} else if ( ! e.shiftKey && document.activeElement === last ) {
				e.preventDefault();
				first.focus();
			}
		}

		function setStatus( msg, isError ) {
			status.textContent = msg || '';
			status.className = 'thelatexlab-modal__status' + ( isError ? ' is-error' : '' );
		}

		function insertAndClose( ref ) {
			close();
			if ( typeof onInsert === 'function' ) { onInsert( ref ); }
		}

		function selectTab( idx ) {
			Array.prototype.forEach.call( tabs.children, function ( b, i ) {
				var active = i === idx;
				b.className = 'thelatexlab-modal__tab' + ( active ? ' is-active' : '' );
				b.setAttribute( 'aria-selected', active ? 'true' : 'false' );
				b.setAttribute( 'tabindex', active ? '0' : '-1' );
			} );
			bodies.innerHTML = '';
			setStatus( '' );
			bodies.appendChild( tabDefs[ idx ].build( { setStatus: setStatus, insert: insertAndClose } ) );
		}

		tabDefs.forEach( function ( def, i ) {
			var tab = elt( 'button', { 'class': 'thelatexlab-modal__tab', type: 'button', role: 'tab', text: def.label } );
			tabs.appendChild( tab );
			tab.addEventListener( 'click', function () { selectTab( i ); } );
			// Arrow-key navigation between tabs.
			tab.addEventListener( 'keydown', function ( e ) {
				if ( 'ArrowRight' === e.key || 'ArrowLeft' === e.key ) {
					e.preventDefault();
					var next = ( i + ( 'ArrowRight' === e.key ? 1 : tabDefs.length - 1 ) ) % tabDefs.length;
					selectTab( next );
					tabs.children[ next ].focus();
				}
			} );
		} );

		var footer = elt( 'div', { 'class': 'thelatexlab-modal__footer' }, [
			elt( 'button', { 'class': 'button thelatexlab-modal__cancel', type: 'button', text: t( 'cancel', 'Cancel' ) } )
		] );
		footer.firstChild.addEventListener( 'click', close );

		modal.appendChild( header );
		modal.appendChild( tabs );
		modal.appendChild( bodies );
		modal.appendChild( status );
		modal.appendChild( footer );
		overlay.appendChild( modal );
		overlay.addEventListener( 'click', function ( e ) { if ( e.target === overlay ) { close(); } } );
		document.addEventListener( 'keydown', onKey );
		document.body.appendChild( overlay );
		selectTab( 0 );
	}

	// --- Tab: paste identifier -----------------------------------------
	function buildPaste( ctx ) {
		var wrap = elt( 'div', { 'class': 'thelatexlab-tab' } );
		var input = elt( 'input', { type: 'text', 'class': 'thelatexlab-input', placeholder: t( 'pastePlaceholder', '' ) } );
		var btn = elt( 'button', { 'class': 'button button-primary', type: 'button', text: t( 'resolve', 'Resolve' ) } );
		var preview = elt( 'div', { 'class': 'thelatexlab-preview' } );

		function run() {
			var value = input.value.trim();
			if ( ! value ) { return; }
			ctx.setStatus( t( 'resolving', 'Resolving...' ) );
			preview.innerHTML = '';
			api( '/resolve', 'POST', { input: value, style: cfg.defaultStyle } ).then( function ( res ) {
				if ( ! res || ! res.ok ) {
					ctx.setStatus( ( res && res.message ) || t( 'errorGeneric', '' ), true );
					return;
				}
				ctx.setStatus( '' );
				preview.appendChild( elt( 'div', { 'class': 'thelatexlab-preview__entry', html: res.html || res.intext } ) );
				var insertBtn = elt( 'button', { 'class': 'button button-primary', type: 'button', text: t( 'insert', 'Insert' ) } );
				insertBtn.addEventListener( 'click', function () {
					// Persist on insert (not on resolve), so previewing or
					// cancelling never creates an orphan reference.
					insertBtn.disabled = true;
					ctx.setStatus( t( 'resolving', '' ) );
					api( '/references', 'POST', {
						csl: res.csl,
						bibtex: res.bibtex,
						identifier: res.identifier,
						source: res.source,
						style: cfg.defaultStyle
					} ).then( function ( saved ) {
						if ( ! saved || ! saved.ok ) {
							ctx.setStatus( ( saved && saved.message ) || t( 'errorGeneric', '' ), true );
							insertBtn.disabled = false;
							return;
						}
						ctx.insert( { id: saved.id, intext: saved.intext, html: saved.html } );
					} ).catch( function () {
						ctx.setStatus( t( 'errorGeneric', '' ), true );
						insertBtn.disabled = false;
					} );
				} );
				preview.appendChild( insertBtn );
			} ).catch( function () { ctx.setStatus( t( 'errorGeneric', '' ), true ); } );
		}

		btn.addEventListener( 'click', run );
		input.addEventListener( 'keydown', function ( e ) { if ( 'Enter' === e.key ) { e.preventDefault(); run(); } } );

		wrap.appendChild( elt( 'div', { 'class': 'thelatexlab-row' }, [ input, btn ] ) );
		wrap.appendChild( preview );
		setTimeout( function () { input.focus(); }, 0 );
		return wrap;
	}

	// --- Tab: search my references --------------------------------------
	function buildSearch( ctx ) {
		var wrap = elt( 'div', { 'class': 'thelatexlab-tab' } );
		var input = elt( 'input', { type: 'search', 'class': 'thelatexlab-input', placeholder: t( 'tabSearch', '' ) } );
		var list = elt( 'ul', { 'class': 'thelatexlab-results' } );
		var timer = null;

		function search() {
			var q = input.value.trim();
			ctx.setStatus( t( 'searching', 'Searching...' ) );
			list.innerHTML = '';
			api( '/references?search=' + encodeURIComponent( q ) + '&style=' + encodeURIComponent( cfg.defaultStyle ), 'GET' ).then( function ( res ) {
				ctx.setStatus( '' );
				if ( ! res || ! res.ok || ! res.references.length ) {
					list.appendChild( elt( 'li', { 'class': 'thelatexlab-results__empty', text: t( 'noResults', '' ) } ) );
					return;
				}
				res.references.forEach( function ( ref ) {
					var li = elt( 'li', { 'class': 'thelatexlab-results__item' }, [
						elt( 'span', { 'class': 'thelatexlab-results__title', html: ref.html || ref.title } )
					] );
					li.addEventListener( 'click', function () {
						ctx.insert( { id: ref.id, intext: ref.intext, html: ref.html } );
					} );
					list.appendChild( li );
				} );
			} ).catch( function () { ctx.setStatus( t( 'errorGeneric', '' ), true ); } );
		}

		input.addEventListener( 'input', function () {
			clearTimeout( timer );
			timer = setTimeout( search, 250 );
		} );

		wrap.appendChild( input );
		wrap.appendChild( list );
		setTimeout( function () { input.focus(); search(); }, 0 );
		return wrap;
	}

	// --- Tab: add manually ----------------------------------------------
	function buildManual( ctx ) {
		var wrap = elt( 'div', { 'class': 'thelatexlab-tab' } );
		var type = elt( 'select', { 'class': 'thelatexlab-input' } );
		[ 'article-journal', 'book', 'chapter', 'paper-conference', 'thesis', 'report', 'webpage' ].forEach( function ( v ) {
			type.appendChild( elt( 'option', { value: v, text: v } ) );
		} );
		var title = elt( 'input', { type: 'text', 'class': 'thelatexlab-input', placeholder: t( 'manualTitle', 'Title' ) } );
		var authors = elt( 'textarea', { 'class': 'thelatexlab-input', rows: '3', placeholder: t( 'manualAuthors', 'Authors' ) } );
		var year = elt( 'input', { type: 'text', 'class': 'thelatexlab-input', placeholder: t( 'manualYear', 'Year' ) } );
		var journal = elt( 'input', { type: 'text', 'class': 'thelatexlab-input', placeholder: t( 'manualJournal', 'Journal' ) } );
		var add = elt( 'button', { 'class': 'button button-primary', type: 'button', text: t( 'add', 'Add reference' ) } );

		add.addEventListener( 'click', function () {
			var csl = { type: type.value };
			if ( title.value.trim() ) { csl.title = title.value.trim(); }
			if ( journal.value.trim() ) { csl[ 'container-title' ] = journal.value.trim(); }
			var y = parseInt( year.value, 10 );
			if ( y ) { csl.issued = { 'date-parts': [ [ y ] ] }; }
			var auth = authors.value.split( '\n' ).map( function ( line ) {
				line = line.trim();
				if ( ! line ) { return null; }
				var parts = line.split( ',' );
				if ( parts.length >= 2 ) { return { family: parts[ 0 ].trim(), given: parts[ 1 ].trim() }; }
				return { literal: line };
			} ).filter( Boolean );
			if ( auth.length ) { csl.author = auth; }

			ctx.setStatus( t( 'resolving', '' ) );
			api( '/references', 'POST', { csl: csl, style: cfg.defaultStyle } ).then( function ( res ) {
				if ( ! res || ! res.ok ) { ctx.setStatus( ( res && res.message ) || t( 'errorGeneric', '' ), true ); return; }
				ctx.insert( { id: res.id, intext: res.intext, html: res.html } );
			} ).catch( function () { ctx.setStatus( t( 'errorGeneric', '' ), true ); } );
		} );

		[ type, title, authors, year, journal, add ].forEach( function ( f ) {
			wrap.appendChild( elt( 'div', { 'class': 'thelatexlab-field' }, [ f ] ) );
		} );
		return wrap;
	}

	window.thelatexlabModal = {
		open: function ( opts ) {
			opts = opts || {};
			buildModal( opts.onInsert );
		}
	};
} )();
