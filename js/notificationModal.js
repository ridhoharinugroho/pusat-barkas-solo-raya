/**
 * ============================================================
 * NOTIFICATION MODAL CONTROLLER
 * ============================================================
 * Solosatset
 *
 * Fix:
 * 1. Modal tidak ditemukan di route /toko-saya
 * 2. Modal tidak muncul setelah tombol bell diklik
 * 3. Modal terhapus / berada di parent yang tersembunyi
 * 4. Tidak menggunakan cloneNode / replaceWith
 * 5. Modal selalu dipasang langsung di <body>
 * ============================================================
 */

const MODAL_ID = 'modal-notifications';
const OPEN_BUTTON_ID = 'btn-open-notifications-modal';
const CLOSE_SELECTOR = '[data-close-modal="modal-notifications"]';

let initialized = false;


/* ============================================================
   CREATE / RECOVER MODAL
   ============================================================ */

function ensureNotificationsModal() {

    let modal = document.getElementById(MODAL_ID);

    /*
     * Jika modal sudah ada tetapi bukan child langsung BODY,
     * pindahkan ke BODY supaya tidak terpengaruh oleh:
     * - overflow:hidden
     * - transform parent
     * - z-index parent
     * - hidden route container
     */
    if (modal) {

        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }

        return modal;
    }


    /*
     * Modal tidak ada sama sekali.
     * Buat ulang secara dinamis.
     */

    console.warn(
        '[Notifications] #modal-notifications tidak ditemukan. Membuat modal otomatis...'
    );

    modal = document.createElement('div');

    modal.id = MODAL_ID;

    modal.className =
        'fixed inset-0 hidden items-center justify-center p-3 sm:p-4 md:p-6';

    /*
     * Gunakan inline style agar tidak tergantung Tailwind
     * atau parent container.
     */
    Object.assign(modal.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483000',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
        background: 'transparent',
        pointerEvents: 'none'
    });


    modal.innerHTML = `
        <!-- BACKDROP -->
        <div
            class="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
            data-close-modal="modal-notifications"
            style="position:absolute;inset:0;">
        </div>


        <!-- MODAL CONTENT -->
        <div
            class="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col text-slate-800"
            style="
                position:relative;
                z-index:2;
                max-height:88vh;
                pointer-events:auto;
            "
        >

            <!-- HEADER -->
            <div
                class="p-4 sm:p-5 bg-gradient-to-r from-rose-950 to-rose-900 text-white flex items-center justify-between"
            >

                <div class="flex items-center gap-3">

                    <div
                        class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"
                    >
                        <i
                            data-lucide="bell"
                            class="w-5 h-5 text-rose-100"
                        ></i>
                    </div>

                    <div>
                        <h2 class="font-black text-base sm:text-lg">
                            Pusat Notifikasi
                        </h2>

                        <p class="text-[10px] sm:text-xs text-rose-200">
                            Aktivitas terbaru akun kamu
                        </p>
                    </div>

                </div>


                <div class="flex items-center gap-2">

                    <button
                        type="button"
                        id="btn-mark-all-notifs-read"
                        class="text-[11px] font-bold bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-xl text-rose-100 hover:text-white transition-all cursor-pointer"
                    >
                        Tandai Dibaca
                    </button>


                    <button
                        type="button"
                        data-close-modal="modal-notifications"
                        class="p-2 text-rose-200 hover:text-white rounded-xl hover:bg-rose-900 transition-colors cursor-pointer"
                        title="Tutup"
                    >
                        <i
                            data-lucide="x"
                            class="w-5 h-5"
                        ></i>
                    </button>

                </div>

            </div>


            <!-- NOTIFICATION LIST -->
            <div
                id="notifications-list-container"
                class="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/70"
            >

                <div
                    id="notifications-empty-state"
                    class="py-12 px-4 text-center space-y-3"
                >

                    <div
                        class="w-16 h-16 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center mx-auto shadow-inner"
                    >
                        <i
                            data-lucide="bell-off"
                            class="w-8 h-8"
                        ></i>
                    </div>

                    <div>
                        <p class="font-bold text-slate-700">
                            Belum ada notifikasi
                        </p>

                        <p class="text-xs text-slate-400 mt-1">
                            Aktivitas terbaru akan muncul di sini.
                        </p>
                    </div>

                </div>

            </div>


            <!-- FOOTER -->
            <div
                class="p-3 sm:p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500"
            >

                <span class="text-[11px] font-medium flex items-center gap-1.5">

                    <span
                        class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                    ></span>

                    <span>
                        Sinkron Realtime Supabase
                    </span>

                </span>


                <button
                    type="button"
                    data-close-modal="modal-notifications"
                    class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                    Tutup
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(modal);


    /*
     * Refresh Lucide icon
     */
    try {
        if (
            window.lucide &&
            typeof window.lucide.createIcons === 'function'
        ) {
            window.lucide.createIcons({
                root: modal
            });
        }
    } catch (e) {
        console.warn(
            '[Notifications] Gagal refresh icon:',
            e
        );
    }


    return modal;
}


/* ============================================================
   OPEN
   ============================================================ */

export function openNotifications() {

    const modal = ensureNotificationsModal();

    if (!modal) {
        console.error(
            '[Notifications] Gagal membuat modal notifikasi.'
        );
        return false;
    }


    /*
     * Pastikan modal langsung berada di BODY.
     */
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }


    /*
     * Hilangkan hidden
     */
    modal.classList.remove('hidden');

    /*
     * Pastikan flex
     */
    modal.classList.add('flex');


    /*
     * Force visibility
     */
    Object.assign(modal.style, {
        display: 'flex',
        visibility: 'visible',
        opacity: '1',
        pointerEvents: 'auto',
        position: 'fixed',
        inset: '0',
        zIndex: '2147483000'
    });


    document.body.style.overflow = 'hidden';


    console.log(
        '[Notifications] Modal opened successfully.'
    );


    /*
     * Beritahu app.js.
     *
     * app.js sudah mempunyai listener untuk:
     * notifications:opened
     */
    window.dispatchEvent(
        new CustomEvent('notifications:opened')
    );


    return true;
}


/* ============================================================
   CLOSE
   ============================================================ */

export function closeNotifications() {

    const modal = document.getElementById(MODAL_ID);

    if (!modal) {
        return;
    }


    modal.classList.add('hidden');
    modal.classList.remove('flex');


    Object.assign(modal.style, {
        display: 'none',
        visibility: 'hidden',
        opacity: '0',
        pointerEvents: 'none'
    });


    document.body.style.overflow = '';


    window.dispatchEvent(
        new CustomEvent('notifications:closed')
    );


    console.log(
        '[Notifications] Modal closed.'
    );
}


/* ============================================================
   INITIALIZE
   ============================================================ */

export function initNotificationsModal() {

    if (initialized) {
        return;
    }

    initialized = true;


    /*
     * Pastikan modal ada sejak awal.
     */
    ensureNotificationsModal();


    /*
     * Tombol bell
     */
    const button =
        document.getElementById(OPEN_BUTTON_ID);


    if (!button) {

        console.error(
            `[Notifications] Tombol #${OPEN_BUTTON_ID} tidak ditemukan.`
        );

        return;
    }


    /*
     * PENTING:
     *
     * Jangan:
     * cloneNode()
     * replaceWith()
     *
     * Kita pasang listener ke tombol asli.
     */

    button.addEventListener(
        'click',
        function(event) {

            event.preventDefault();
            event.stopPropagation();

            console.log(
                '[Notifications] Bell clicked'
            );

            openNotifications();

        },
        false
    );


    /*
     * Delegated close handler.
     *
     * Ini tetap bekerja meskipun modal dibuat
     * secara dinamis.
     */
    document.addEventListener(
        'click',
        function(event) {

            const closeElement =
                event.target.closest(CLOSE_SELECTOR);

            if (!closeElement) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            closeNotifications();

        },
        false
    );


    /*
     * Klik backdrop
     */
    document.addEventListener(
        'click',
        function(event) {

            const modal =
                document.getElementById(MODAL_ID);

            if (!modal) {
                return;
            }

            /*
             * Hanya jika yang diklik adalah container modal
             * atau backdrop.
             */
            if (
                event.target === modal ||
                event.target.classList?.contains('modal-backdrop')
            ) {
                closeNotifications();
            }

        },
        false
    );


    /*
     * ESC
     */
    document.addEventListener(
        'keydown',
        function(event) {

            if (event.key !== 'Escape') {
                return;
            }

            const modal =
                document.getElementById(MODAL_ID);

            if (
                modal &&
                !modal.classList.contains('hidden')
            ) {
                closeNotifications();
            }

        }
    );


    /*
     * Expose untuk debugging.
     */
    window.openNotifications = openNotifications;
    window.closeNotifications = closeNotifications;
    window.ensureNotificationsModal =
        ensureNotificationsModal;


    console.log(
        '[Notifications] Controller initialized.'
    );
}
