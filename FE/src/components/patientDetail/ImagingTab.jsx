import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import Colors from '../../constants/colors';
import { FolderArchive } from 'lucide-react';

const ImagingTab = ({
  imagingResults = [],
  navigation,
}) => {
  return (
    <View style={{ marginTop: 16 }}>
      {imagingResults.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrapper}>
            <FolderArchive size={32} color="#64748B" />
          </View>
          <Text style={styles.emptyTitle}>Chưa có phim chụp</Text>
          <Text style={styles.emptySubtitle}>Chưa có phim chụp nào được ghi nhận cho bệnh án này.</Text>
        </View>
      ) : (
        imagingResults.map((item) => {
          const date = new Date(item.reportDate);
          const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} lúc ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          
          return (
            <TouchableOpacity
              key={item._id}
              style={styles.imagingCard}
              onPress={() => navigation.navigate('ImagingResult', { resultId: item._id })}
            >
              <View style={styles.cardHeader}>
                <View style={[
                  styles.badge,
                  { backgroundColor: item.imagingType === 'MRI' ? '#EFF6FF' : '#FDF4FF' }
                ]}>
                  <Text style={[
                    styles.badgeText,
                    { color: item.imagingType === 'MRI' ? Colors.info : '#C026D3' }
                  ]}>
                    {item.imagingType}
                  </Text>
                </View>
                <Text style={styles.dateText}>{dateStr}</Text>
              </View>

              <Text style={styles.procedureText}>{item.procedure}</Text>
              <Text style={styles.metaText}>Bác sĩ: <Text style={styles.metaBold}>{item.radiologist}</Text></Text>
              <Text style={styles.metaText}>Chẩn đoán: <Text style={styles.metaBold}>{item.diagnosis}</Text></Text>
              
              <View style={styles.divider} />
              
              <Text style={styles.conclusionLabel}>Kết luận:</Text>
              <Text style={styles.conclusionText} numberOfLines={2}>{item.conclusion}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
  },
  imagingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  badgeText: {
    fontWeight: 'bold',
  },
  dateText: {
    color: '#64748B',
    fontSize: 13,
  },
  procedureText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  metaText: {
    color: '#475569',
    fontSize: 14,
    marginBottom: 4,
  },
  metaBold: {
    fontWeight: '500',
    color: '#1E293B',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  conclusionLabel: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 4,
  },
  conclusionText: {
    color: '#334155',
    fontSize: 14,
  },
});

export default ImagingTab;
