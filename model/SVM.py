import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib

data = pd.read_csv("XSS_dataset.csv")

x = data['Sentence']
y = data['Label']

x_train_text, x_test_text, y_train, y_test = train_test_split(
    x,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

tfidf = TfidfVectorizer(
    max_features=5000,
    lowercase=True,
    analyzer='word',
    token_pattern=r"(?u)\b[^\s]+\b",
    ngram_range=(1, 2)
)

x_train = tfidf.fit_transform(x_train_text)

x_test = tfidf.transform(x_test_text)

svm_model = LinearSVC()
svm_model.fit(x_train, y_train)

y_predict = svm_model.predict(x_test)

accuracy = accuracy_score(y_test, y_predict)
confus_matrix = confusion_matrix(y_test, y_predict)
class_report = classification_report(y_test, y_predict)

print("================ XSS SVM Model Assessment ================\n")
print(f"Accuracy: {accuracy:.4f}")

print("\nConfusion Matrix:\n", confus_matrix)

print("\nClassification Report:\n", class_report)

joblib.dump(svm_model, "svm_xss_model.joblib")
joblib.dump(tfidf, "tfidf_xss_svm.joblib")

print("\nĐã lưu mô hình: svm_xss_model.joblib")
print("Đã lưu TF-IDF: tfidf_xss_svm.joblib")