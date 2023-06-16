import React, { useState, useEffect } from "react";
import { Text, Button, View, StyleSheet, Alert, Linking } from "react-native";
import { Camera } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import ExcelJS from "exceljs";

export function BarcodeScan({ onBarCodeRead }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [torchOn, setTorchOn] = useState(Camera.Constants.FlashMode.off);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const handleTorch = () => {
    setTorchOn(
      torchOn === Camera.Constants.FlashMode.off
        ? Camera.Constants.FlashMode.torch
        : Camera.Constants.FlashMode.off
    );
  };

  if (hasPermission === null) {
    return <View />;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }
  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        flashMode={torchOn}
        onBarCodeScanned={onBarCodeRead}
      ></Camera>
      {/* <Button title="Toggle Flashlight" onPress={handleTorch} /> */}
    </View>
  );
}

export function App() {
  const [boxes, setBoxes] = useState({});
  const [currentBox, setCurrentBox] = useState(null);
  const [isStartingNewBox, setIsStartingNewBox] = useState(false);
  const [readyToScanNextItem, setReadyToScanNextItem] = useState(true); // new state

  const onBarCodeRead = ({ type, data }) => {
    if (!readyToScanNextItem) return; // if not ready to scan next item, do nothing

    if (isStartingNewBox) {
      startNewBox(data);
      setIsStartingNewBox(false);
    } else {
      if (currentBox === null) {
        Alert.alert(
          "Ошибка",
          "Начните новую коробку перед сканированием продукта."
        );
        return;
      }

      // If the barcode starts with 'WB_', it's a box, not a product. Ignore it.
      if (data.startsWith("WB_")) {
        return;
      }

      let box = boxes[currentBox] || {};

      let product = box[data] || {
        barcode: data,
        quantity: 0,
        hasKIZ: hasKIZ(data),
      };
      product.quantity++;

      box[data] = product;
      setBoxes({ ...boxes, [currentBox]: box });

      // Add alert here
      Alert.alert("Успех", "ШК продукта отсканирован.");
      setReadyToScanNextItem(false); // set readyToScanNextItem to false after successful scan
    }
  };

  const startNewBox = (barcode) => {
    // Если штрихкод начинается с 'WB_', значит это коробка.
    if (barcode.startsWith("WB_")) {
      // Извлекаем номер коробки, идущий после 'WB_'.
      let boxNumber = barcode.slice();
      setCurrentBox(boxNumber);
      Alert.alert("Начата новая коробка", "Штрих-код коробки: " + boxNumber);
      Alert.alert("Успех", "ШК коробки отсканирован.");
    } else {
      Alert.alert("Ошибка", "Неверный шк код.");
    }
  };

  const hasKIZ = (barcode) => {
    // Implement your logic here to determine if a product has a KIZ.
    // This is a placeholder that returns false for all barcodes.
    return false;
  };

  const generateExcel = async () => {
    let workbook = new ExcelJS.Workbook();
    let worksheet = workbook.addWorksheet("My Sheet");

    worksheet.columns = [
      { header: "Barcode", key: "barcode", width: 32 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Box Barcode", key: "box", width: 32 },
      { header: "Has KIZ", key: "hasKIZ", width: 10 },
    ];

    Object.keys(boxes).forEach((boxBarcode) => {
      let box = boxes[boxBarcode];
      Object.keys(box).forEach((productBarcode) => {
        let product = box[productBarcode];
        worksheet.addRow({
          barcode: product.barcode,
          quantity: product.quantity,
          box: boxBarcode,
          hasKIZ: product.hasKIZ ? "да" : "нет",
        });
      });
    });

    let buffer = await workbook.xlsx.writeBuffer();
    let base64 = buffer.toString("base64");
    let uri = FileSystem.cacheDirectory + "PackingList.xlsx";
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return uri;
  };

  const shareExcel = async () => {
    let uri = await generateExcel();
    await Sharing.shareAsync(uri, {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Packing List",
      UTI: "com.microsoft.excel.xlsx",
    });
  };

  const emailExcel = async () => {
    let uri = await generateExcel();
    let url = `mailto:youremail@example.com?subject=Packing List&body=Here is the packing list: ${uri}`;
    let canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    }
  };
  return (
    <View style={styles.container}>
      <BarcodeScan onBarCodeRead={onBarCodeRead} />
      <View style={styles.buttonContainer}>
        <View style={styles.leftButtonGroup}>
          <Button
            title="Поделиться"
            onPress={shareExcel}
            style={styles.button}
          />
          <Button
            title="Отправить по Email"
            onPress={emailExcel}
            style={styles.button}
          />
        </View>
        <View style={styles.rightButtonGroup}>
          <Button
            title="Новая коробка"
            onPress={() => setIsStartingNewBox(true)}
            style={styles.button}
          />
          <Button
            title="Сканировать товар"
            onPress={() => setReadyToScanNextItem(true)}
            style={styles.button}
          />
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    width: "100%",
    paddingHorizontal: 20,
  },
  leftButtonGroup: {
    flexDirection: "column",
    justifyContent: "space-around",
    // marginRight: 20,
    marginBottom: 10, // Add bottom margin
  },
  rightButtonGroup: {
    flexDirection: "column",
    justifyContent: "space-around",
    // marginLeft: 10,
    marginTop: 10, // Add top margin
  },
  button: {
    alignItems: "center",
    backgroundColor: "#DDDDDD",
    // padding: 10,
    // paddingBottom: 20, // Добавляем отступ снизу
    width: "100%", // Adjust as needed
    height: 50, // Adjust as needed
    // paddingTop: 20, // Добавляем отступ сверху
  },

  buttonText: {},
  preview: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  text: {
    fontSize: 20, // Adjust as needed
    // fontSize: 18,
    color: "white",
    backgroundColor: "black",
    padding: 10,
  },
  camera: {
    width: 300,
    height: 300,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default App;
