import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import api from '../api/axios';
import NewTicketModal from '../components/NewTicketModal';
import TicketChatModal from '../components/TicketChatModal';
import { useAuth } from '../context/AuthContext';

const COLORS = {
  navy: '#0A2F6B',
  primary: '#0E7C97',
  primaryLight: '#1790B8',
  background: '#F1F7FC',
  white: '#FFFFFF',
  text: '#1C2B3F',
  muted: '#62738A',
  border: '#E0EAF3',
  success: '#12A37F',
  successBackground: '#D9F5EE',
  warning: '#D98A06',
  warningBackground: '#FFF1CF',
  danger: '#DC2626',
};

const CATEGORY_STYLES = {
  Administratif: { icon: 'D', background: '#E3EDFB', color: '#2F6FD0' },
  Financier: { icon: '$', background: '#DCF3F3', color: '#0E929C' },
  Inscription: { icon: '+', background: '#FDE6E6', color: '#E5484D' },
  Pédagogique: { icon: 'L', background: '#ECE8FB', color: '#6C4FD6' },
  Technique: { icon: 'T', background: COLORS.warningBackground, color: COLORS.warning },
  Autre: { icon: '?', background: '#E3EDFB', color: '#2F6FD0' },
};

function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function shortDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR');
}

function dateAndTime(value) {
  if (!value || shortDate(value) === '—') return '—';
  return `${shortDate(value)} ${new Date(value).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function normalizeTicket(ticket) {
  return {
    id: String(ticket.id),
    sujet: ticket.title,
    categorie: ticket.department,
    description: ticket.description || '',
    statut: ticket.status === 'closed' ? 'ferme' : ticket.status === 'in_progress' ? 'en_cours' : 'ouvert',
    rawStatus: ticket.status,
    unreadChatCount: ticket.unreadChatCount || 0,
    dateCreation: ticket.openedAt || ticket.createdAt,
    dateMiseAJour: ticket.updatedAt || ticket.closedAt || ticket.openedAt || ticket.createdAt,
  };
}

function StatusBadge({ status }) {
  return (
    <View style={[styles.statusBadge, status === 'ferme' ? styles.statusClosed : status === 'en_cours' ? styles.statusProgress : styles.statusOpen]}>
      <Text style={[styles.statusText, { color: status === 'ferme' ? COLORS.success : status === 'en_cours' ? COLORS.primary : COLORS.warning }]}>
        {status === 'ferme' ? 'Fermé' : status === 'en_cours' ? 'En cours' : 'Ouvert'}
      </Text>
    </View>
  );
}

function StatCard({ label, value, tone, stacked }) {
  return (
    <View style={[styles.statCard, stacked && styles.statCardStacked]}>
      <View style={[styles.statIcon, styles[`statIcon${tone}`]]}>
        <Text style={[styles.statSymbol, styles[`statSymbol${tone}`]]}>{tone === 'Total' ? '▤' : tone === 'Open' ? '◷' : '✓'}</Text>
      </View>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, styles[`statValue${tone}`]]}>{value}</Text>
      </View>
    </View>
  );
}

export default function TicketsScreen({ unreadTicketIds = [] }) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width > 1180;
  const isStacked = width <= 600;
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('tous');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [toast, setToast] = useState(null);
  const [chatTicket, setChatTicket] = useState(null);

  const fetchTickets = useCallback(async () => {
    try {
      const response = await api.get('/mytickets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTickets((response.data.content || []).map(normalizeTicket));
      setLoadError('');
    } catch (error) {
      setLoadError(error.response?.data?.error || 'Impossible de charger vos tickets.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeout = setTimeout(fetchTickets, 0);
    return () => clearTimeout(timeout);
  }, [fetchTickets]);

  useEffect(() => {
    if (isWide && !selectedId && tickets.length) {
      const timeout = setTimeout(() => setSelectedId(tickets[0].id), 0);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [isWide, selectedId, tickets]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const query = normalize(search.trim().replace(/^#/, ''));
  const filteredTickets = [...tickets]
    .filter((ticket) => filter === 'tous' || (filter === 'ouvert' ? ticket.statut !== 'ferme' : ticket.statut === 'ferme'))
    .filter((ticket) => !query || normalize(`${ticket.sujet} ${ticket.id}`).includes(query))
    .sort((a, b) => new Date(b.dateCreation) - new Date(a.dateCreation));
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId);
  const openCount = tickets.filter((ticket) => ticket.statut !== 'ferme').length;
  const closedCount = tickets.length - openCount;

  const openModal = () => setModalVisible(true);

  const toggleStatus = async () => {
    if (!selectedTicket) return;
    const nextStatus = selectedTicket.statut !== 'ferme' ? 'closed' : 'open';
    const nextLabel = nextStatus === 'closed' ? 'fermé' : 'rouvert';
    try {
      await api.put(
        `/myticket/${selectedTicket.id}`,
        { status: nextStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchTickets();
      setToast({ message: `Ticket #${selectedTicket.id} ${nextLabel}.`, type: 'success' });
    } catch (error) {
      setToast({ message: error.response?.data?.error || 'Impossible de modifier le ticket.', type: 'error' });
    }
  };

  const detailsPanel = (
    <View style={[styles.detailsPanel, isWide && styles.detailsPanelWide]}>
      {selectedTicket ? (
        <>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedId(null)}>
            <Text style={styles.backButtonText}>‹  Retour à la liste</Text>
          </TouchableOpacity>
          <View style={styles.detailTitleRow}>
            <Text style={styles.detailTitle}>#{selectedTicket.id}</Text>
            <StatusBadge status={selectedTicket.statut} />
          </View>
          <View style={styles.detailLine}>
            <Text style={styles.detailIcon}>◷</Text>
            <Text style={styles.detailCopy}>Date de création : {shortDate(selectedTicket.dateCreation)}</Text>
          </View>
          <View style={styles.detailLine}>
            <Text style={styles.detailIcon}>▤</Text>
            <Text style={styles.detailCopy}><Text style={styles.detailStrong}>Objet : </Text>{selectedTicket.sujet}</Text>
          </View>
          <View style={styles.detailLine}>
            <Text style={styles.detailIcon}>▧</Text>
            <View style={styles.detailDescriptionBlock}>
              <Text style={styles.detailStrong}>Description :</Text>
              <Text style={styles.descriptionText}>{selectedTicket.description}</Text>
            </View>
          </View>
          <View style={styles.detailLine}>
            <Text style={styles.detailIcon}>◷</Text>
            <Text style={styles.detailCopy}>Service : {selectedTicket.categorie}</Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailLine}>
            <Text style={styles.detailIcon}>◷</Text>
            <Text style={styles.detailCopy}>Dernière mise à jour : {dateAndTime(selectedTicket.dateMiseAJour)}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>i</Text>
            <Text style={styles.infoText}>
              {selectedTicket.statut !== 'ferme'
                ? "Votre demande est en cours de traitement. Vous serez notifié dès qu'il y aura une réponse."
                : 'Cette demande est clôturée. Vous pouvez la rouvrir si besoin.'}
            </Text>
          </View>
          {(selectedTicket.statut !== 'ferme' || unreadTicketIds.includes(Number(selectedTicket.id))) && (
            <TouchableOpacity style={styles.chatAction} onPress={() => setChatTicket(selectedTicket)}>
              <Text style={styles.chatActionIcon}>▤</Text>
              <Text style={styles.chatActionText}>Ouvrir la conversation</Text>
              {unreadTicketIds.includes(Number(selectedTicket.id)) && <View style={styles.chatActionDot} />}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.statusAction, selectedTicket.statut !== 'ferme' && styles.closeAction]}
            onPress={toggleStatus}
          >
            <Text style={[styles.statusActionText, selectedTicket.statut !== 'ferme' && styles.closeActionText]}>
              {selectedTicket.statut !== 'ferme' ? 'Fermer le ticket' : 'Rouvrir le ticket'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.demoNote}>Les modifications sont synchronisées avec le service de support.</Text>
        </>
      ) : (
        <View style={styles.emptyDetails}>
          <Text style={styles.emptyDetailsIcon}>▤</Text>
          <Text style={styles.emptyDetailsText}>Sélectionnez un ticket pour afficher son contenu complet.</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.page, isWide && styles.pageWide]}>
        <View style={[styles.mainColumn, isWide && styles.mainColumnWide]}>
          <View style={styles.pageHeader}>
            <View style={styles.titleGroup}>
              <View style={styles.pageIcon}><Text style={styles.pageIconText}>▤</Text></View>
              <View>
                <Text style={styles.pageTitle}>Mes tickets</Text>
                <Text style={styles.pageSubtitle}>Suivez vos demandes administratives</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.createButton} onPress={openModal}>
              <Text style={styles.createButtonText}>＋  Nouveau ticket</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.statsRow, isStacked && styles.statsRowStacked]}>
            <StatCard label="Total" value={tickets.length} tone="Total" stacked={isStacked} />
            <StatCard label="Ouverts" value={openCount} tone="Open" stacked={isStacked} />
            <StatCard label="Fermés" value={closedCount} tone="Closed" stacked={isStacked} />
          </View>

          <View style={[styles.toolbar, width <= 860 && styles.toolbarStacked]}>
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                accessibilityLabel="Rechercher un ticket"
                style={styles.searchInput}
                placeholder="Rechercher un ticket…"
                placeholderTextColor="#8AA0B8"
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <View style={styles.filters}>
              {[
                { key: 'tous', label: 'Tous' },
                { key: 'ouvert', label: 'Ouverts' },
                { key: 'ferme', label: 'Fermés' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === item.key }}
                  onPress={() => setFilter(item.key)}
                  style={[styles.filterButton, filter === item.key && styles.filterButtonActive]}
                >
                  <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.ticketList}>
            {loading ? (
              <ActivityIndicator style={styles.listLoader} color={COLORS.primary} />
            ) : loadError ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListTitle}>{loadError}</Text>
                <TouchableOpacity onPress={fetchTickets} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            ) : filteredTickets.length ? filteredTickets.map((ticket) => {
              const categoryStyle = CATEGORY_STYLES[ticket.categorie] || CATEGORY_STYLES.Autre;
              const isSelected = selectedId === ticket.id;
              return (
                <View key={ticket.id} style={[styles.ticketCard, isSelected && styles.ticketCardSelected]}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSelectedId(ticket.id)}
                    style={styles.ticketSelect}
                  >
                    <View style={styles.ticketIconWrap}>
                      <View style={[styles.ticketIcon, { backgroundColor: categoryStyle.background }]}>
                        <Text style={[styles.ticketIconText, { color: categoryStyle.color }]}>{categoryStyle.icon}</Text>
                      </View>
                      {unreadTicketIds.includes(Number(ticket.id)) && <View style={styles.ticketUnreadDot} />}
                    </View>
                    <View style={styles.ticketCopy}>
                      <View style={styles.ticketMeta}>
                        <Text style={styles.ticketId}>#{ticket.id}</Text>
                        <Text style={styles.ticketDate}> · {shortDate(ticket.dateCreation)}</Text>
                      </View>
                      <Text style={styles.ticketSubject} numberOfLines={1}>{ticket.sujet}</Text>
                      <Text style={styles.ticketDescription} numberOfLines={1}>{ticket.description}</Text>
                    </View>
                    <StatusBadge status={ticket.statut} />
                  </TouchableOpacity>
                  {(ticket.rawStatus !== 'closed' || unreadTicketIds.includes(Number(ticket.id))) && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Ouvrir la conversation du ticket ${ticket.id}`}
                      onPress={() => setChatTicket(ticket)}
                      style={styles.ticketChatMini}
                    >
                      <Text style={styles.ticketChatMiniText}>▤</Text>
                      {unreadTicketIds.includes(Number(ticket.id)) && <View style={styles.ticketUnreadDot} />}
                    </TouchableOpacity>
                  )}
                </View>
              );
            }) : (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListTitle}>Aucun ticket trouvé.</Text>
                <Text style={styles.emptyListCopy}>Modifiez votre recherche ou votre filtre, ou créez un nouveau ticket.</Text>
              </View>
            )}
          </View>
        </View>

        {detailsPanel}
      </ScrollView>

      <NewTicketModal
        visible={modalVisible}
        token={token}
        onClose={() => setModalVisible(false)}
        onCreated={async (createdTicket) => {
          setFilter('tous');
          setSearch('');
          setSelectedId(String(createdTicket.id));
          await fetchTickets();
        }}
      />

      <TicketChatModal visible={!!chatTicket} ticket={chatTicket} token={token} onClose={() => setChatTicket(null)} />

      {toast ? (
        <View style={[styles.toast, toast.type === 'error' && styles.toastError]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  page: { flexGrow: 1, paddingHorizontal: 4, paddingBottom: 24, gap: 22 },
  pageWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainColumn: { width: '100%', minWidth: 0 },
  mainColumnWide: { flex: 1 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 20,
  },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pageIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F0F9',
  },
  pageIconText: { color: COLORS.primaryLight, fontSize: 25, fontWeight: '700' },
  pageTitle: { color: COLORS.navy, fontSize: 25, lineHeight: 31, fontWeight: '800' },
  pageSubtitle: { color: COLORS.muted, fontSize: 13, marginTop: 2 },
  createButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  createButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 14 },
  statsRowStacked: { flexDirection: 'column' },
  statCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    shadowColor: '#0B3C78',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  statCardStacked: { width: '100%' },
  statIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  statIconTotal: { backgroundColor: '#E3EDFB' },
  statIconOpen: { backgroundColor: COLORS.warningBackground },
  statIconClosed: { backgroundColor: COLORS.successBackground },
  statSymbol: { fontSize: 22, fontWeight: '700' },
  statSymbolTotal: { color: '#2F6FD0' },
  statSymbolOpen: { color: COLORS.warning },
  statSymbolClosed: { color: COLORS.success },
  statLabel: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 25, lineHeight: 29, fontWeight: '800', marginTop: 1 },
  statValueTotal: { color: '#1F5FBF' },
  statValueOpen: { color: COLORS.warning },
  statValueClosed: { color: COLORS.success },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 14 },
  toolbarStacked: { flexDirection: 'column', alignItems: 'stretch' },
  searchBox: {
    minWidth: 180,
    minHeight: 42,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  searchIcon: { color: COLORS.primaryLight, fontSize: 22, lineHeight: 24 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 8, color: COLORS.text, fontSize: 13, outlineStyle: 'none' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { color: COLORS.primaryLight, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: COLORS.white },
  ticketList: { gap: 10 },
  ticketCard: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    shadowColor: '#0B3C78',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  ticketCardSelected: { borderColor: COLORS.primaryLight, borderWidth: 2 },
  ticketSelect: { flex: 1, minWidth: 0, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 13 },
  ticketIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  ticketIconWrap: { position: 'relative' },
  ticketUnreadDot: { position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#fff' },
  ticketIconText: { fontSize: 18, fontWeight: '800' },
  ticketCopy: { flex: 1, minWidth: 0 },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  ticketId: { color: COLORS.muted, fontSize: 11, fontWeight: '800', fontFamily: 'monospace' },
  ticketDate: { color: COLORS.muted, fontSize: 11 },
  ticketSubject: { color: COLORS.navy, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  ticketDescription: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  statusBadge: { minWidth: 68, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusOpen: { backgroundColor: COLORS.warningBackground },
  statusProgress: { backgroundColor: '#DBEAFE' },
  statusClosed: { backgroundColor: COLORS.successBackground },
  statusText: { fontSize: 11, fontWeight: '700' },
  ticketChevron: { width: 24, color: COLORS.primaryLight, textAlign: 'center', fontSize: 24, lineHeight: 26 },
  ticketChatMini: { position: 'relative', width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  ticketChatMiniText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  listLoader: { marginVertical: 24 },
  emptyList: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 32, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, backgroundColor: COLORS.white },
  emptyListTitle: { color: COLORS.navy, fontSize: 14, fontWeight: '800' },
  emptyListCopy: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  retryButton: { paddingHorizontal: 15, paddingVertical: 8, marginTop: 12, borderRadius: 8, backgroundColor: COLORS.primary },
  retryButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  detailsPanel: {
    width: '100%',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    shadowColor: '#0B3C78',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  detailsPanelWide: { width: 360, flexShrink: 0, marginTop: 0 },
  emptyDetails: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40, paddingHorizontal: 12 },
  emptyDetailsIcon: { color: '#98AEC5', fontSize: 36 },
  emptyDetailsText: { color: COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  backButton: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backButtonText: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  detailTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 15 },
  detailTitle: { color: COLORS.navy, fontSize: 22, fontWeight: '800' },
  detailLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 },
  detailIcon: { width: 20, color: COLORS.primaryLight, fontSize: 17, textAlign: 'center' },
  detailCopy: { flex: 1, color: COLORS.text, fontSize: 12, lineHeight: 19 },
  detailStrong: { color: COLORS.navy, fontWeight: '700' },
  detailDescriptionBlock: { flex: 1 },
  descriptionText: { color: COLORS.text, fontSize: 12, lineHeight: 19, marginTop: 3 },
  detailDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 9 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, marginTop: 12, borderRadius: 11, backgroundColor: '#EEF5FB' },
  infoIcon: { width: 19, height: 19, borderRadius: 10, overflow: 'hidden', color: COLORS.primaryLight, borderWidth: 1, borderColor: COLORS.primaryLight, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  infoText: { flex: 1, color: COLORS.muted, fontSize: 11, lineHeight: 17 },
  statusAction: { minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 14, borderRadius: 9, backgroundColor: COLORS.primary },
  statusActionText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  chatAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 14, marginTop: 12, borderRadius: 9, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  chatActionIcon: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  chatActionText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  chatActionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  closeAction: { borderWidth: 1, borderColor: '#FECACA', backgroundColor: COLORS.white },
  closeActionText: { color: COLORS.danger },
  demoNote: { color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 9 },
  toast: { position: 'absolute', right: 22, bottom: 18, maxWidth: 340, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#22D3EE', backgroundColor: COLORS.navy, elevation: 8 },
  toastError: { borderLeftColor: COLORS.danger },
  toastText: { color: COLORS.white, fontSize: 12, lineHeight: 18 },
});
