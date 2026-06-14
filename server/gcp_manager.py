import os
import json
from datetime import datetime
from google.cloud import storage
from google.cloud import firestore
from google.oauth2 import service_account

class GCPManager:
    def __init__(self):
        self.project_id = os.getenv("GCP_PROJECT_ID")
        self.bucket_name = os.getenv("GCS_BUCKET_NAME")
        self.credentials_json = os.getenv("GCP_CREDENTIALS_JSON")
        self.firestore_db = os.getenv("GCP_FIRESTORE_DATABASE", "(default)")
        
        self.storage_client = None
        self.firestore_client = None
        self.bucket = None
        
        self.storage_enabled = False
        self.firestore_enabled = False

        # If GCS_BUCKET_NAME is not set, we gracefully disable GCP integration
        if not self.bucket_name:
            print("GCP Storage disabled (GCS_BUCKET_NAME not set in environment). Using ephemeral in-memory storage.")
            return

        try:
            # 1. Initialize Credentials
            credentials = None
            if self.credentials_json:
                try:
                    info = json.loads(self.credentials_json)
                    credentials = service_account.Credentials.from_service_account_info(info)
                    print("GCP Credentials loaded from environment variable GCP_CREDENTIALS_JSON.")
                except Exception as ex:
                    print(f"Error parsing GCP_CREDENTIALS_JSON: {ex}")

            # 2. Initialize GCS Client
            if credentials:
                self.storage_client = storage.Client(project=self.project_id, credentials=credentials)
            else:
                self.storage_client = storage.Client(project=self.project_id)
            
            self.bucket = self.storage_client.bucket(self.bucket_name)
            self.storage_enabled = True
            print(f"GCP Storage initialized successfully. Bucket: {self.bucket_name}")
            
        except Exception as e:
            print(f"Failed to initialize GCP Storage: {e}")
            self.storage_enabled = False

        try:
            # 3. Initialize Firestore Client
            if credentials:
                self.firestore_client = firestore.Client(project=self.project_id, credentials=credentials, database=self.firestore_db)
            else:
                self.firestore_client = firestore.Client(project=self.project_id, database=self.firestore_db)
            self.firestore_enabled = True
            print(f"GCP Firestore initialized successfully. Database: {self.firestore_db}")
        except Exception as e:
            print(f"Failed to initialize GCP Firestore: {e}")
            self.firestore_enabled = False

    def upload_media(self, file_bytes: bytes, destination_path: str, content_type: str) -> str:
        """
        Uploads raw binary bytes to Google Cloud Storage bucket and returns the public URL.
        """
        if not self.storage_enabled or not self.bucket:
            return ""
        try:
            blob = self.bucket.blob(destination_path)
            blob.upload_from_string(file_bytes, content_type=content_type)
            # Make public so clients can stream directly
            try:
                blob.make_public()
            except Exception as e:
                # If bucket policies restrict public URLs (e.g. uniform bucket-level access), log and continue
                print(f"Warning: Could not make blob public (checking IAM permissions): {e}")
            
            return blob.public_url
        except Exception as e:
            print(f"Error uploading {destination_path} to GCS: {e}")
            return ""

    def save_story(self, story_id: str, story_data: dict) -> bool:
        """
        Saves story metadata and public asset URLs to Firestore collection 'stories'.
        """
        if not self.firestore_enabled:
            return False
        try:
            doc_ref = self.firestore_client.collection("stories").document(story_id)
            doc_ref.set({
                **story_data,
                "created_at": datetime.utcnow().isoformat()
            })
            print(f"Saved story {story_id} to Firestore.")
            return True
        except Exception as e:
            print(f"Error saving story {story_id} to Firestore: {e}")
            return False

    def get_recent_stories(self, limit: int = 10) -> list:
        """
        Fetches the recent stories from Firestore sorted by creation date descending.
        """
        if not self.firestore_enabled:
            return []
        try:
            stories_ref = self.firestore_client.collection("stories")
            query = stories_ref.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)
            docs = query.stream()
            
            stories = []
            for doc in docs:
                story = doc.to_dict()
                story["story_id"] = doc.id
                stories.append(story)
            return stories
        except Exception as e:
            print(f"Error fetching stories from Firestore: {e}")
            return []
