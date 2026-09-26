package usecase

import (
	"context"

	"{{module-path}}/internal/modules/example/domain"
	"{{module-path}}/internal/platform/observability"
)

type ListItemsInput struct {
	Page  int
	Limit int
}

type ListItemsOutput struct {
	Data []domain.Item
	Meta PaginationMeta
}

type PaginationMeta struct {
	Page       int
	Limit      int
	Total      int
	TotalPages int
}

type ListItemsUseCase struct {
	Items ItemRepository
}

func NewListItemsUseCase(items ItemRepository) *ListItemsUseCase {
	return &ListItemsUseCase{Items: items}
}

func (uc *ListItemsUseCase) Execute(ctx context.Context, input ListItemsInput) (ListItemsOutput, error) {
	page := input.Page
	if page <= 0 {
		page = 1
	}
	limit := input.Limit
	if limit <= 0 {
		limit = 20
	}

	result, err := uc.Items.FindMany(ctx, FindManyParams{Page: page, Limit: limit})
	if err != nil {
		return ListItemsOutput{}, err
	}

	observability.Metrics.ItemsListed.Inc()

	totalPages := 0
	if limit > 0 {
		totalPages = (result.Total + limit - 1) / limit
	}

	return ListItemsOutput{
		Data: result.Items,
		Meta: PaginationMeta{Page: page, Limit: limit, Total: result.Total, TotalPages: totalPages},
	}, nil
}
