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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Loader2 } from "lucide-react";
import { getMenuItems, getCategories, createOrder } from "../api/customAcios";

const MenuManagement = () => {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    is_available: true,
  });

  const {
    data: menuItems,
    isLoading: itemsLoading,
    error: itemsError,
  } = useQuery("menuItems", getMenuItems);

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useQuery("categories", getCategories);

  const createMenuItem = useMutation((newItem) => createOrder(newItem), {
    onSuccess: () => {
      queryClient.invalidateQueries("menuItems");
      resetForm();
    },
    onError: (error) => {
      console.error("Failed to create item:", error);
    },
  });

  const updateMenuItem = useMutation(
    (updatedItem) =>
      api
        .patch(`/menu-items/${selectedItem.id}/`, updatedItem)
        .then((res) => res.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries("menuItems");
        resetForm();
      },
      onError: (error) => {
        console.error("Failed to update item:", error);
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedItem) {
      updateMenuItem.mutate(formData);
    } else {
      createMenuItem.mutate(formData);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      category: "",
      is_available: true,
    });
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Menu Management</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Item Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            <Textarea
              placeholder="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Price"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: e.target.value })
              }
            />
            {!categoriesLoading && (
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={createMenuItem.isLoading || updateMenuItem.isLoading}
              >
                {(createMenuItem.isLoading || updateMenuItem.isLoading) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {selectedItem ? "Update Item" : "Add Item"}
              </Button>
              {selectedItem && (
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>

          <div className="mt-8">
            {itemsLoading ? (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : itemsError ? (
              <p className="text-red-500">Failed to load menu items.</p>
            ) : (
              <div className="grid gap-4">
                {menuItems?.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-bold">{item.name}</h3>
                        <p className="text-sm text-gray-600">
                          {item.description}
                        </p>
                        <p className="text-sm">${item.price}</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedItem(item);
                          setFormData(item);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MenuManagement;
