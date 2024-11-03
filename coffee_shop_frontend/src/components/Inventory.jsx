import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Loader2 } from "lucide-react";
import { api } from "../api/customAcios"; // Adjust the path to your API module if needed

const Inventory = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    item_name: "",
    description: "",
    reported_by: "",
  });

  // Fetch broken items with react-query and axios
  const { data: brokenItems, isLoading } = useQuery("brokenItems", async () => {
    const response = await api.get("/broken-items/");
    return response.data;
  });

  // Mutation for creating a new broken item
  const createBrokenItem = useMutation(
    async (newItem) => {
      const response = await api.post("/broken-items/", newItem);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries("brokenItems");
        setFormData({ item_name: "", description: "", reported_by: "" });
      },
    }
  );

  // Mutation for resolving a broken item
  const resolveBrokenItem = useMutation(
    async (itemId) => {
      const response = await api.post(`/broken-items/${itemId}/resolve/`);
      return response.data;
    },
    {
      onSuccess: () => queryClient.invalidateQueries("brokenItems"),
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    createBrokenItem.mutate(formData);
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Inventory & Broken Items</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <Input
              placeholder="Item Name"
              value={formData.item_name}
              onChange={(e) =>
                setFormData({ ...formData, item_name: e.target.value })
              }
            />
            <Textarea
              placeholder="Description of Issue"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
            <Input
              placeholder="Reported By"
              value={formData.reported_by}
              onChange={(e) =>
                setFormData({ ...formData, reported_by: e.target.value })
              }
            />
            <Button type="submit" disabled={createBrokenItem.isLoading}>
              {createBrokenItem.isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Report Broken Item
            </Button>
          </form>

          {isLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4">
              {brokenItems?.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{item.item_name}</h3>
                      <p className="text-sm text-gray-600">
                        {item.description}
                      </p>
                      <p className="text-sm">Reported by: {item.reported_by}</p>
                      <p className="text-sm">
                        Reported at:{" "}
                        {new Date(item.reported_at).toLocaleDateString()}
                      </p>
                    </div>
                    {!item.resolved && (
                      <Button
                        variant="outline"
                        onClick={() => resolveBrokenItem.mutate(item.id)}
                        disabled={resolveBrokenItem.isLoading}
                      >
                        {resolveBrokenItem.isLoading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Mark as Resolved
                      </Button>
                    )}
                    {item.resolved && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                        Resolved
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;
