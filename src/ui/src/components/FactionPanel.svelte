<script lang="ts">
  import { FactionType, getFactionTypeName, getFactionCategory } from '../../../shared/types';

  // ── Onay etiket + ikon + renk haritası ──────────────────────────────────
  const APPROVAL_META: Record<string, { label: string; color: string; icon: string }> = {
    systemApproval:        { label: 'Sistem Onayı',          color: '#94a3b8', icon: '✓' },
    hoodApproval:          { label: 'Hood Onayı',           color: '#fbbf24', icon: '◆' },
    weaponApproval:        { label: 'Silah Onayı',          color: '#ef4444', icon: '⚔' },
    drugApproval:          { label: 'Uyuşturucu Onayı',    color: '#10b981', icon: '●' },
    illegalGarageApproval: { label: 'Tamirhane Onayı',     color: '#6366f1', icon: '○' },
    unionMember:           { label: 'Sendika Üyesi',         color: '#60a5fa', icon: '☆' },
    // geriye dönük uyumluluk
    isVerified:            { label: 'Sistem Onayı',          color: '#94a3b8', icon: '✓' },
    canHaveWeapons:        { label: 'Silah Onayı',          color: '#ef4444', icon: '⚔' },
  };

  const DEFAULT_FACTION = {
    id: 1,
    name: 'Los Santos Polis Departmanı',
    founderName: 'James Morrison',
    type: FactionType.LAW_ENFORCEMENT,
    approvals: { isVerified: true},
    stockValue: 125000,
    members: [
      { id: 1, name: 'James Morrison', rank: 5, division: 'Komutanlık' },
      { id: 2, name: 'Sarah Connor',   rank: 3, division: 'Trafik' },
      { id: 3, name: 'Michael Torres', rank: 2, division: 'Özel Harekat' },
    ],
    tasks: [
      { id: 1, name: 'İlk Adım',      status: 'done'   },
      { id: 2, name: 'Ekip Kur',      status: 'done'   },
      { id: 3, name: 'Bölgeyi Güven Altına Al', status: 'active' },
      { id: 4, name: 'Üst Komuta Onayla',       status: 'locked' },
      { id: 5, name: 'Tam Yetki',               status: 'locked' },
    ] as any[],
    ranks: [
      { id: 1, name: 'Stajyer',    salary: 500  },
      { id: 2, name: 'Memur',      salary: 1000 },
      { id: 3, name: 'Komiser',    salary: 2500 },
      { id: 4, name: 'Başkomiser', salary: 4000 },
      { id: 5, name: 'Komutan',    salary: 7500 },
    ],
    divisions: [
      { id: 1, name: 'Trafik' },
      { id: 2, name: 'Özel Harekat' },
      { id: 3, name: 'Komutanlık' },
    ],
    vehicles: [] as any[],
  };

  let {
    factionData = DEFAULT_FACTION,
    onClose = undefined,
    onInviteMember = undefined,
  }: {
    factionData?: any;
    onClose?: () => void;
    onInviteMember?: () => void;
  } = $props();

  let activeTab = $state('info');

  const category    = $derived(getFactionCategory(factionData.type));
  const typeName    = $derived(getFactionTypeName(factionData.type));
  // Sadece ŞİRKET için hisse değeri göster
  const isCompany   = $derived(category === 'ŞİRKET');
  // Hem DEVLET KURUMU hem ŞİRKET maaş sistemi kullanır
  const hasSalary   = $derived(category === 'DEVLET KURUMU' || category === 'ŞİRKET');

  const accentColor = $derived(
    category === 'DEVLET KURUMU' ? '#60a5fa' :
    category === 'ŞİRKET'        ? '#34d399' :
    '#f87171'
  );
  const accentGlow  = $derived(accentColor + '1a');

  // approvals objesinden aktif onayları meta verileriyle al
  const activeApprovals = $derived(
    Object.entries(factionData.approvals || {})
      .filter(([, v]) => v === true)
      .map(([k]) => APPROVAL_META[k] ?? { label: k, color: '#94a3b8', icon: '●' })
  );

  // Görevlerin durumunu belirle: isCompleted veya status desteği
  function taskStatus(task: any): 'done' | 'active' | 'locked' {
    if (task.isCompleted === true || task.status === 'done') return 'done';
    if (task.status === 'active') return 'active';
    return 'locked';
  }

  const tabs = [
    { id: 'info',      label: 'Bilgiler',         icon: '◈' },
    { id: 'story',     label: 'Hikaye Ağacı',      icon: '◉' },
    { id: 'members',   label: 'Üyeler',            icon: '◎' },
    { id: 'ranks',     label: 'Rütbeler',          icon: '◇' },
    { id: 'divisions', label: 'Divizyonlar',       icon: '◈' },
    { id: 'vehicles',  label: 'Araçlar / Mülkler', icon: '◆' },
  ];

  function close() {
    if (onClose) onClose();
  }

  function triggerMp(event: string, ...args: unknown[]) {
    if (typeof (window as any).mp !== 'undefined') {
      (window as any).mp.trigger(event, ...args);
    }
  }
</script>

<div class="panel" style="--accent: {accentColor}; --accent-glow: {accentGlow};">
  <!-- ── Sağ üst kapatma butonu ────────────────────────────── -->
  <button class="close-corner" onclick={close} aria-label="Kapat">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  </button>

  <!-- ── Sidebar ─────────────────────────────────────────── -->
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="faction-avatar">
        {factionData.name[0]}
      </div>
      <div class="faction-meta">
        <span class="faction-title">{factionData.name}</span>
        <span class="faction-badge">{category}</span>
      </div>
    </div>

    <nav class="sidebar-nav">
      {#each tabs as tab}
        <button
          class="nav-btn"
          class:active={activeTab === tab.id}
          onclick={() => activeTab = tab.id}
        >
          <span class="nav-icon">{tab.icon}</span>
          {tab.label}
        </button>
      {/each}
    </nav>
  </aside>

  <!-- ── Content ────────────────────────────────────────── -->
  <main class="content">

    <!-- BİLGİLER -->
    {#if activeTab === 'info'}
      <section class="tab-section">
        <h2 class="tab-title">Birlik Bilgileri</h2>

        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Birlik Adı</span>
            <span class="info-value">{factionData.name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Kurucu</span>
            <span class="info-value">{factionData.founderName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Birlik Tipi</span>
            <span class="info-value">
              <span class="category-tag">{category}</span>
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Birlik Türü</span>
            <span class="info-value">{typeName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Onaylar</span>
            <span class="info-value badges-wrap">
              {#if activeApprovals.length > 0}
                {#each activeApprovals as meta}
                  <span
                    class="badge approval-badge"
                    style="
                      background: {meta.color}1a;
                      color: {meta.color};
                      border-color: {meta.color}33;
                    "
                  >
                    <span class="approval-icon">{meta.icon}</span>
                    {meta.label}
                  </span>
                {/each}
              {:else}
                <span class="badge badge-gray">Onay Yok</span>
              {/if}
            </span>
          </div>
          {#if isCompany}
            <div class="info-row">
              <span class="info-label">Hisse Değeri</span>
              <span class="info-value stock-value">
                ₺{(factionData.stockValue ?? 0).toLocaleString('tr-TR')}
              </span>
            </div>
          {/if}
        </div>
      </section>

    <!-- HİKAYE AĞACI -->
    {:else if activeTab === 'story'}
      <section class="tab-section">
        <h2 class="tab-title">Hikaye Ağacı</h2>
        {#if (factionData.tasks || []).length === 0}
          <div class="empty-state">
            <div class="empty-icon">◎</div>
            <span>Henüz tanımlanmış bir görev yok.</span>
          </div>
        {:else}
          <div class="task-tree">
            {#each (factionData.tasks || []) as task, i}
              {@const status = taskStatus(task)}
              <div class="task-node {status}">
                <!-- Bağlantı çizgisi (son eleman hariç) -->
                {#if i < (factionData.tasks || []).length - 1}
                  <div class="task-connector"></div>
                {/if}

                <div class="task-bubble">
                  {#if status === 'done'}
                    <span class="task-status-icon done">✓</span>
                  {:else if status === 'active'}
                    <span class="task-status-icon active">◉</span>
                  {:else}
                    <span class="task-status-icon locked">⊘</span>
                  {/if}
                  <div class="task-body">
                    <span class="task-name">{task.name}</span>
                    {#if task.description}
                      <span class="task-desc">{task.description}</span>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </section>

    <!-- ÜYELER -->
    {:else if activeTab === 'members'}
      <section class="tab-section">
        <div class="members-header">
          <h2 class="tab-title" style="margin:0; border:none; padding:0;">Üyeler
            <span class="member-count">{(factionData.members || []).length}</span>
          </h2>
          <div class="btn-group">
            <button class="btn btn-success btn-sm" onclick={() => onInviteMember && onInviteMember()}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              Üye Al
            </button>
            <button class="btn btn-danger btn-sm">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1 6h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              Üye At
            </button>
          </div>
        </div>

        <div class="member-list">
          {#if (factionData.members || []).length === 0}
            <!-- Skeleton loader -->
            <div class="skeleton-wrap">
              {#each [1,2,3] as _}
                <div class="skeleton-row">
                  <div class="skeleton-cell wide"></div>
                  <div class="skeleton-cell mid"></div>
                  <div class="skeleton-cell mid"></div>
                  <div class="skeleton-cell narrow"></div>
                </div>
              {/each}
              <p class="skeleton-hint">Birlik verileri senkronize ediliyor…</p>
            </div>
          {:else}
            <div class="list-header">
              <span>İsim</span>
              <span>Rütbe</span>
              <span>Divizyon</span>
              <span></span>
            </div>
            {#each (factionData.members || []) as member}
              <div class="member-row">
                <span class="member-name">{member.name}</span>
                <span class="member-rank-tag">Rütbe {member.rank}</span>
                <span class="member-div">{member.division ?? '—'}</span>
                <div class="member-actions">
                  <button class="icon-btn" title="Rütbe Düzenle" aria-label="Rütbe Düzenle">
                    <!-- yıldız ikonu -->
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                      <path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.3L10 14.4l-4.8 2.5.9-5.3L2.2 7.7l5.4-.8z"
                        stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                    </svg>
                  </button>
                  <button class="icon-btn" title="Divizyon Düzenle" aria-label="Divizyon Düzenle">
                    <!-- kişi grubu ikonu -->
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                      <circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M1 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                      <path d="M14 4.5a3 3 0 1 1 0 5M19 17c0-3.3-2.3-5.5-5-5.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </section>

    <!-- RÜTBELER -->
    {:else if activeTab === 'ranks'}
      <section class="tab-section">
        <h2 class="tab-title">Rütbeler</h2>
        <div class="action-bar">
          <button class="btn btn-primary" onclick={() => triggerMp('client:faction:updateCounts', factionData.id, 'ranks')}>
            ⊞ Rütbe Sayısı Belirle
          </button>
        </div>

        <div class="rank-list">
          {#each (factionData.ranks || []) as rank}
            <div class="rank-row">
              <span class="rank-num">{rank.id}</span>
              <input
                class="rank-name-input"
                type="text"
                value={rank.name}
                placeholder="Rütbe Adı"
              />
              <button class="btn btn-sm btn-outline">Yetkilendirme</button>
              {#if hasSalary}
                <div class="salary-group">
                  <label class="salary-label" for="salary-{rank.id}">Maaş (₺)</label>
                  <input
                    id="salary-{rank.id}"
                    class="salary-input"
                    type="number"
                    value={rank.salary ?? 0}
                    placeholder="0"
                    min="0"
                  />
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>

    <!-- DİVİZYONLAR -->
    {:else if activeTab === 'divisions'}
      <section class="tab-section">
        <h2 class="tab-title">Divizyonlar</h2>
        <div class="action-bar">
          <button class="btn btn-primary" onclick={() => triggerMp('client:faction:updateCounts', factionData.id, 'divisions')}>
            ⊞ Divizyon Sayısı Belirle
          </button>
        </div>

        <div class="division-list">
          {#each (factionData.divisions || []) as div}
            <div class="division-row">
              <span class="div-num">{div.id}</span>
              <input
                class="div-name-input"
                type="text"
                value={div.name}
                placeholder="Divizyon Adı"
              />
            </div>
          {/each}
        </div>
      </section>

    <!-- ARAÇLAR / MÜLKLER -->
    {:else if activeTab === 'vehicles'}
      <section class="tab-section">
        <h2 class="tab-title">Araç / Mülk Bilgileri</h2>
        {#if (factionData.vehicles || []).length === 0}
          <div class="empty-state">
            <div class="empty-icon">◆</div>
            <span>Kayıtlı araç veya mülk bulunmuyor.</span>
          </div>
        {:else}
          <div class="member-list">
            <div class="list-header" style="grid-template-columns: 1fr 140px 140px;">
              <span>Model</span>
              <span>Plaka</span>
              <span>Durum</span>
            </div>
            {#each (factionData.vehicles || []) as vehicle}
              <div class="member-row" style="grid-template-columns: 1fr 140px 140px;">
                <span class="member-name">{vehicle.model ?? '—'}</span>
                <span class="member-div">{vehicle.plate ?? '—'}</span>
                <span class="member-rank-tag">{vehicle.status ?? 'Aktif'}</span>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    {/if}

  </main>
</div>

<style>
  /* ─── CSS custom properties ──────────────────────────────────────────────────
   *   --accent      : category color  (#60a5fa | #34d399 | #f87171)
   *   --accent-glow : accent at ~10% opacity for focus box-shadow
   * ─────────────────────────────────────────────────────────────────────────── */

  /* ── Panel Root ────────────────────────────────────────── */
  .panel {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 900px;
    height: 600px;
    background: rgba(18, 18, 22, 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.03);
    border-radius: 18px;
    display: flex;
    overflow: hidden;
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.75);
    font-family: 'Segoe UI', 'Inter', sans-serif;
    color: #cbd5e1;
    user-select: none;
  }

  /* ── Corner Close Button ───────────────────────────────── */
  .close-corner {
    position: absolute;
    top: 25px;
    right: 25px;
    z-index: 10;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    color: #64748b;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .close-corner:hover {
    background: rgba(248, 113, 113, 0.14);
    border-color: rgba(248, 113, 113, 0.25);
    color: #f87171;
  }

  /* ── Sidebar ───────────────────────────────────────────── */
  .sidebar {
    width: 230px;
    min-width: 230px;
    background: transparent;
    display: flex;
    flex-direction: column;
    border-right: 1px solid rgba(255, 255, 255, 0.03);
  }

  .sidebar-brand {
    padding: 20px 16px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    min-height: 80px;
  }

  .faction-avatar {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 12px;
    border: 1px solid var(--accent);
    background: rgba(255, 255, 255, 0.05);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
  }

  .faction-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
  }

  .faction-title {
    font-size: 12px;
    font-weight: 600;
    color: #f1f5f9;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .faction-badge {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 2px 8px;
    border-radius: 20px;
    text-transform: uppercase;
    width: fit-content;
    background: rgba(255, 255, 255, 0.05);
    color: var(--accent);
    border: 1px solid var(--accent);
  }

  /* ── Navigation ────────────────────────────────────────── */
  .sidebar-nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 10px 8px;
    gap: 2px;
    overflow-y: auto;
  }

  .nav-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-left: 2px solid transparent;
    border-radius: 8px;
    color: #64748b;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .nav-btn:hover {
    background: rgba(255, 255, 255, 0.03);
    color: #cbd5e1;
  }

  .nav-btn.active {
    background: rgba(255, 255, 255, 0.05);
    color: var(--accent);
    font-weight: 600;
    border-left-color: var(--accent);
    border-radius: 0 8px 8px 0;
  }

  .nav-icon {
    font-size: 11px;
    opacity: 0.4;
    transition: opacity 0.15s;
  }

  .nav-btn.active .nav-icon,
  .nav-btn:hover .nav-icon {
    opacity: 1;
  }

  /* ── Content Area ──────────────────────────────────────── */
  .content {
    flex: 1;
    overflow-y: auto;
    padding: 28px 30px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
  }

  .content::-webkit-scrollbar { width: 4px; }
  .content::-webkit-scrollbar-track { background: transparent; }
  .content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 4px; }

  .tab-section {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .tab-title {
    font-size: 18px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.01em;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    margin: 0;
  }

  .sub-title {
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ── Info Grid ─────────────────────────────────────────── */
  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-radius: 12px;
    overflow: hidden;
  }

  .info-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.015);
    gap: 16px;
    transition: background 0.12s;
  }

  .info-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .info-label {
    width: 130px;
    min-width: 130px;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  .info-value {
    font-size: 14px;
    font-weight: 500;
    color: #cbd5e1;
    flex: 1;
  }

  .category-tag {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: rgba(255, 255, 255, 0.06);
    color: var(--accent);
    border: 1px solid var(--accent);
  }

  .badges-wrap {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  /* Onaylı Birlik — her zaman yeşil */
  .badge-green {
    background: rgba(52, 211, 153, 0.1);
    color: #34d399;
    border: 1px solid rgba(52, 211, 153, 0.2);
  }

  /* Onay Badgeleri (dinamik renk inline style ile) */
  .approval-badge {
    border: 1px solid;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .approval-icon {
    font-size: 12px;
    line-height: 1;
  }

  /* Silah İzni — her zaman mavi */
  .badge-blue {
    background: rgba(96, 165, 250, 0.1);
    color: #60a5fa;
    border: 1px solid rgba(96, 165, 250, 0.2);
  }

  .badge-gray {
    background: rgba(255, 255, 255, 0.05);
    color: #64748b;
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  /* Hisse değeri — pastel altın */
  .stock-value {
    font-size: 15px;
    font-weight: 700;
    color: #c2a052;
    font-variant-numeric: tabular-nums;
  }

  /* ── Empty State ───────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    gap: 12px;
    color: #64748b;
    font-size: 14px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.015);
  }

  .empty-icon {
    font-size: 32px;
    opacity: 0.35;
    color: var(--accent);
  }

  /* ── Action Bars ───────────────────────────────────────── */
  .action-bar {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .action-bar-bottom {
    margin-top: 4px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
  }

  /* Members header bar */
  .members-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .member-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    padding: 0 8px;
    height: 20px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    vertical-align: middle;
  }

  .btn-group {
    display: flex;
    gap: 0;
    border-radius: 9px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .btn-group .btn {
    border-radius: 0;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
  }

  .btn-group .btn:last-child { border-right: none; }

  /* ── Buttons (Ghost/Outline) ───────────────────────────── */
  .btn {
    padding: 8px 18px;
    border-radius: 8px;
    border: 1px solid transparent;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.03em;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
  }

  .btn:active { transform: scale(0.97); }

  /* Yeşil — üye al, başarı */
  .btn-success {
    background: rgba(52, 211, 153, 0.1);
    color: #34d399;
    border-color: rgba(52, 211, 153, 0.2);
  }
  .btn-success:hover {
    background: rgba(52, 211, 153, 0.2);
    border-color: rgba(52, 211, 153, 0.35);
  }

  /* Kırmızı — yıkıcı işlemler */
  .btn-danger {
    background: rgba(248, 113, 113, 0.1);
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.2);
  }
  .btn-danger:hover {
    background: rgba(248, 113, 113, 0.2);
    border-color: rgba(248, 113, 113, 0.35);
  }

  /* Turuncu — düzenleme */
  .btn-warning {
    background: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.2);
  }
  .btn-warning:hover {
    background: rgba(251, 191, 36, 0.2);
    border-color: rgba(251, 191, 36, 0.35);
  }

  /* Mavi — birincil eylemler */
  .btn-primary {
    background: rgba(96, 165, 250, 0.1);
    color: #60a5fa;
    border-color: rgba(96, 165, 250, 0.2);
  }
  .btn-primary:hover {
    background: rgba(96, 165, 250, 0.2);
    border-color: rgba(96, 165, 250, 0.35);
  }

  .btn-sm {
    padding: 5px 12px;
    font-size: 11px;
    border-radius: 6px;
  }

  .btn-outline {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
  }

  .btn-outline:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.18);
    color: #cbd5e1;
  }

  /* ── Members ───────────────────────────────────────────── */
  .member-list {
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    overflow: hidden;
    gap: 2px;
  }

  .list-header {
    display: grid;
    grid-template-columns: 1fr 120px 140px 64px;
    padding: 9px 14px;
    background: rgba(255, 255, 255, 0.025);
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-radius: 8px 8px 0 0;
  }

  .member-row {
    display: grid;
    grid-template-columns: 1fr 120px 140px 64px;
    align-items: center;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.015);
    font-size: 13px;
    transition: background 0.12s;
  }

  .member-row:hover { background: rgba(255, 255, 255, 0.035); }

  .member-name { font-weight: 500; color: #f1f5f9; }

  .member-rank-tag {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.06);
    color: var(--accent);
    width: fit-content;
  }

  .member-div { color: #64748b; font-size: 12px; }

  .member-actions {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }

  .icon-btn {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 7px;
    color: #64748b;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    padding: 0;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    color: var(--accent);
    border-color: var(--accent);
  }

  /* ── Ranks ─────────────────────────────────────────────── */
  .rank-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rank-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.015);
    border-radius: 10px;
  }

  .rank-num {
    width: 22px;
    height: 22px;
    min-width: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }

  .rank-name-input,
  .salary-input,
  .div-name-input {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 7px;
    color: #cbd5e1;
    font-size: 13px;
    padding: 6px 10px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .rank-name-input { flex: 1; }

  .rank-name-input:focus,
  .salary-input:focus,
  .div-name-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .salary-group {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 8px;
  }

  .salary-label {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .salary-input {
    width: 90px;
  }

  /* ── Divisions ─────────────────────────────────────────── */
  .division-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .division-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.015);
    border-radius: 10px;
  }

  .div-num {
    width: 22px;
    height: 22px;
    min-width: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
  }

  .div-name-input { flex: 1; }

  /* ── Skeleton Loader ──────────────────────────────────────────── */
  .skeleton-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 0;
  }

  .skeleton-row {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.015);
    border-radius: 8px;
    overflow: hidden;
  }

  .skeleton-cell {
    height: 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .skeleton-cell.wide   { flex: 1; }
  .skeleton-cell.mid    { width: 100px; }
  .skeleton-cell.narrow { width: 60px; }

  @keyframes shimmer {
    0%, 100% { opacity: 0.4; }
    50%       { opacity: 0.8; }
  }

  .skeleton-hint {
    text-align: center;
    font-size: 12px;
    color: #475569;
    margin: 4px 0 0;
    letter-spacing: 0.02em;
  }

  /* ── Task Tree ─────────────────────────────────────────── */
  .task-tree {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 4px 0;
  }

  .task-node {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  /* Dikey bağlantı çizgisi */
  .task-connector {
    position: absolute;
    left: 19px;
    top: 44px;
    width: 2px;
    height: calc(100% - 10px);
    background: rgba(255, 255, 255, 0.06);
    z-index: 0;
  }

  .task-node.done .task-connector  { background: rgba(52, 211, 153, 0.3); }
  .task-node.active .task-connector { background: rgba(194, 160, 82, 0.3); }

  .task-bubble {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 5px 0;
    padding: 11px 16px;
    border-radius: 12px;
    width: 100%;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.15s;
  }

  /* Tamamlanmış */
  .task-node.done .task-bubble {
    background: rgba(52, 211, 153, 0.06);
    border-color: rgba(52, 211, 153, 0.15);
  }

  /* Aktif — altın glow */
  .task-node.active .task-bubble {
    background: rgba(194, 160, 82, 0.08);
    border-color: rgba(194, 160, 82, 0.35);
    box-shadow: 0 0 16px rgba(194, 160, 82, 0.1);
  }

  /* Kilitli — blur + şeffaf */
  .task-node.locked .task-bubble {
    opacity: 0.45;
    filter: blur(0.5px);
    pointer-events: none;
  }

  .task-status-icon {
    width: 28px;
    height: 28px;
    min-width: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
  }

  .task-status-icon.done {
    background: rgba(52, 211, 153, 0.15);
    color: #34d399;
    border: 1px solid rgba(52, 211, 153, 0.3);
  }

  .task-status-icon.active {
    background: rgba(194, 160, 82, 0.18);
    color: #c2a052;
    border: 1px solid rgba(194, 160, 82, 0.45);
    box-shadow: 0 0 8px rgba(194, 160, 82, 0.3);
    animation: pulse-gold 2s ease-in-out infinite;
  }

  .task-status-icon.locked {
    background: rgba(255, 255, 255, 0.04);
    color: #475569;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  @keyframes pulse-gold {
    0%, 100% { box-shadow: 0 0 6px rgba(194, 160, 82, 0.25); }
    50%       { box-shadow: 0 0 14px rgba(194, 160, 82, 0.55); }
  }

  .task-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .task-name {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .task-node.done .task-name  { color: #34d399; }
  .task-node.active .task-name { color: #c2a052; }
  .task-node.locked .task-name { color: #475569; }

  .task-desc {
    font-size: 11px;
    color: #64748b;
  }
</style>
