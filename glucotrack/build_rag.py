import os
import time
import pandas as pd
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document

# 1. Initialize local embeddings (runs locally, no API key required)
print("Loading local embedding model (all-MiniLM-L6-v2)...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# 2. Build FAISS Vector Store
def build_vector_store(docs, embed_model):
    print(f"Indexing {len(docs)} documents into FAISS...")
    store = FAISS.from_documents(docs, embed_model)
    store.save_local("faiss_glucotrack_index")
    print("Successfully indexed and saved FAISS vector store to 'faiss_glucotrack_index'!")
    return store

# 3. Dynamic RAG Updater
def add_meal_to_rag(food_name, meal_type, net_carbs, post_glucose, date_str="Today"):
    new_doc_text = (
        f"Date: {date_str}. Meal Type: {meal_type}. "
        f"Food Consumed: {food_name}. Net Carbs: {net_carbs}g. "
        f"Post-Meal Glucose Reading: {post_glucose} mmol/L."
    )
    
    vector_store = FAISS.load_local(
        "faiss_glucotrack_index", 
        embeddings, 
        allow_dangerous_deserialization=True
    )
    vector_store.add_documents([Document(page_content=new_doc_text)])
    vector_store.save_local("faiss_glucotrack_index")
    print("New meal entry indexed into FAISS vector store!")

# 4. Main Execution
if __name__ == "__main__":
    csv_filename = "August 2026.csv"
    documents = []
    
    if os.path.exists(csv_filename):
        print(f"Loading meal data from {csv_filename}...")
        df = pd.read_csv(csv_filename)
        meal_df = df[df['Reading Type'] == 'Post-Meal'].dropna(subset=['Food'])

        for idx, row in meal_df.iterrows():
            text_content = (
                f"Date: {row['Formatted Date']}. "
                f"Meal Type: {row['Meal Type']}. "
                f"Food Consumed: {row['Food']}. "
                f"Net Carbs: {row['Net Carbs (g)']}g. "
                f"Post-Meal Glucose Reading: {row['Glucose (mmol/L)']} mmol/L."
            )
            doc = Document(
                page_content=text_content,
                metadata={"id": row['ID'], "glucose": float(row['Glucose (mmol/L)'])}
            )
            documents.append(doc)
    else:
        print(f"Warning: '{csv_filename}' not found. Building index with baseline health documents.")

    # Baseline health documents
    documents.append(Document(page_content="High glycemic index carbohydrates cause steep blood glucose spikes. Adding vegetables, fiber, and lean protein buffers the glucose response."))
    documents.append(Document(page_content="A normal post-meal blood glucose reading is under 7.8 mmol/L. Readings consistently above 10.0 mmol/L indicate high post-prandial glycemic spikes."))

    build_vector_store(documents, embeddings)