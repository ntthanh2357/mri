import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import useHome from '../controllers/useHome';
import Button from '../components/Button';
import Colors from '../constants/colors';

const HomeScreen = () => {
  const { data, loading, error, refetch } = useHome();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MRI App</Text>
      {loading && <ActivityIndicator color={Colors.primary} />}
      {error && <Text style={styles.error}>{error}</Text>}
      {data && <Text style={styles.message}>{data.message}</Text>}
      <Button title="Tải lại" onPress={refetch} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: Colors.black },
  message: { fontSize: 16, color: Colors.secondary },
  error: { fontSize: 14, color: Colors.error },
});

export default HomeScreen;
